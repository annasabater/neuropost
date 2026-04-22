'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Check, X, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import type { WeeklyPlan, ContentIdea } from '@/types';

const C = {
  bg1: '#f5f5f5', card: '#ffffff', border: '#E5E7EB',
  text: '#111111', muted: '#6B7280', accent: '#0F766E',
  red: '#EF4444',
};

interface PlanWithBrand extends WeeklyPlan {
  brands?: { name: string };
}

export default function WorkerWeeklyPlanPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const [plan, setPlan]   = useState<PlanWithBrand | null>(null);
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [loading, setLoading]   = useState(true);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  // Debounce timers per idea
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const res  = await fetch(`/api/worker/weekly-plans/${id}`);
    const data = await res.json() as { plan?: PlanWithBrand; ideas?: ContentIdea[]; error?: string };
    if (!res.ok || !data.plan) { toast.error(data.error ?? 'Plan no encontrado'); router.push('/worker/validation'); return; }
    setPlan(data.plan);
    setIdeas(data.ideas ?? []);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  function patchIdeaLocal(ideaId: string, patch: Partial<ContentIdea>) {
    setIdeas((prev) => prev.map((i) => i.id === ideaId ? { ...i, ...patch } : i));
  }

  function scheduleAutoSave(ideaId: string, patch: Record<string, unknown>) {
    clearTimeout(debounceRefs.current[ideaId]);
    debounceRefs.current[ideaId] = setTimeout(async () => {
      setSaving((s) => ({ ...s, [ideaId]: true }));
      await fetch(`/api/worker/weekly-plans/${id}/ideas/${ideaId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(patch),
      });
      setSaving((s) => ({ ...s, [ideaId]: false }));
    }, 1000);
  }

  async function handleApprove() {
    const res  = await fetch(`/api/worker/weekly-plans/${id}/approve`, { method: 'POST' });
    const data = await res.json() as { ok?: boolean; error?: string };
    if (!res.ok) { toast.error(data.error ?? 'Error al aprobar'); return; }
    toast.success('Plan aprobado — email enviado al cliente');
    router.push('/worker/validation');
  }

  async function handleReject() {
    if (!rejectReason.trim()) { toast.error('El motivo es obligatorio'); return; }
    setRejecting(true);
    const res  = await fetch(`/api/worker/weekly-plans/${id}/reject`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ skip_reason: rejectReason }),
    });
    const data = await res.json() as { ok?: boolean; error?: string };
    setRejecting(false);
    if (!res.ok) { toast.error(data.error ?? 'Error al rechazar'); return; }
    toast.success('Plan rechazado');
    router.push('/worker/validation');
  }

  if (loading) return <div style={{ padding: 40, color: C.muted }}>Cargando plan...</div>;
  if (!plan)   return null;

  const brandName = (plan as PlanWithBrand).brands?.name ?? plan.brand_id;
  const weekLabel = formatWeek(plan.week_start);

  // Hide superseded ideas (their replacement occupies the slot). The client
  // view already filters these — the worker view should match so the counts
  // and numbering stay consistent.
  const visibleIdeas = ideas.filter((i) => i.status !== 'replaced_by_variation');

  return (
    <div style={{ padding: 28, maxWidth: 900, color: C.text }}>
      {/* Header */}
      <button onClick={() => router.push('/worker/validation')} style={backBtn}>
        <ArrowLeft size={14} /> Volver a validación
      </button>

      <div style={{ marginTop: 16, marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>{brandName}</h1>
        <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
          Semana del {weekLabel} · {visibleIdeas.length} ideas
        </p>
      </div>

      {/* Ideas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
        {visibleIdeas.map((idea, i) => (
          <div key={idea.id} style={{ background: C.card, border: `1px solid ${C.border}`, padding: 20 }}>
            {idea.original_idea_id && idea.awaiting_worker_review && (
              <div style={{
                display:      'flex',
                alignItems:   'flex-start',
                gap:          8,
                padding:      '10px 12px',
                background:   '#fef3c7',
                color:        '#92400e',
                border:       '1px solid #f59e0b',
                marginBottom: 12,
                fontSize:     12,
                lineHeight:   1.5,
              }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>⚠️</span>
                <span>
                  <strong>Variación regenerada pendiente de tu revisión.</strong>{' '}
                  Se enviará al cliente cuando actúes sobre esta idea (edítala, o aprueba/rechaza el plan entero).
                </span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
              <span style={numBadge}>{i + 1}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{idea.angle}</span>
                  <span style={formatPill}>{idea.format}</span>
                  {saving[idea.id] && <span style={{ fontSize: 11, color: C.muted }}>guardando…</span>}
                </div>
                {idea.hook && (
                  <p style={{ fontSize: 12, color: C.muted, margin: '0 0 8px', fontStyle: 'italic' }}>{idea.hook}</p>
                )}
              </div>
            </div>

            <label style={fieldLabel}>Copy propuesto</label>
            <textarea
              value={idea.copy_draft ?? ''}
              onChange={(e) => {
                patchIdeaLocal(idea.id, { copy_draft: e.target.value });
                scheduleAutoSave(idea.id, { copy_draft: e.target.value });
              }}
              rows={4}
              style={textarea}
              placeholder="Sin copy — puedes añadirlo aquí"
            />

            <label style={{ ...fieldLabel, marginTop: 10 }}>Hashtags (separados por espacio)</label>
            <input
              value={(idea.hashtags ?? []).join(' ')}
              onChange={(e) => {
                const tags = e.target.value.split(/\s+/).filter(Boolean);
                patchIdeaLocal(idea.id, { hashtags: tags });
                scheduleAutoSave(idea.id, { hashtags: tags });
              }}
              style={inputField}
              placeholder="#hashtag1 #hashtag2"
            />

            {idea.suggested_asset_url && (
              <div style={{ marginTop: 10 }}>
                <label style={fieldLabel}>Asset sugerido</label>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={idea.suggested_asset_url} alt="" style={{ maxWidth: 200, maxHeight: 150, display: 'block', marginTop: 4, border: `1px solid ${C.border}` }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer actions */}
      <div style={{ display: 'flex', gap: 10, borderTop: `2px solid ${C.border}`, paddingTop: 20 }}>
        <button onClick={handleApprove} style={approveBtn}>
          <Send size={14} /> Aprobar y enviar al cliente
        </button>
        <button onClick={() => setShowRejectModal(true)} style={rejectBtn}>
          <X size={14} /> Rechazar plan
        </button>
      </div>

      {/* Reject modal */}
      {showRejectModal && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>Rechazar plan</h3>
            <p style={{ color: C.muted, fontSize: 13, margin: '0 0 12px' }}>
              Indica el motivo para que quede registrado.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              style={{ ...textarea, marginBottom: 12 }}
              placeholder="Motivo del rechazo..."
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleReject} disabled={rejecting} style={rejectBtn}>
                <X size={13} /> {rejecting ? 'Rechazando…' : 'Confirmar rechazo'}
              </button>
              <button onClick={() => setShowRejectModal(false)} style={cancelBtn}>
                Cancelar
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
  padding: '6px 12px', background: 'transparent', border: `1px solid #E5E7EB`,
  color: '#6B7280', borderRadius: 0, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
};
const numBadge: React.CSSProperties = {
  width: 24, height: 24, background: '#111827', color: '#fff',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 11, fontWeight: 700, flexShrink: 0,
};
const formatPill: React.CSSProperties = {
  fontSize: 10, padding: '2px 7px', background: '#f5f5f5', color: '#6B7280',
  borderRadius: 0, textTransform: 'uppercase', letterSpacing: 0.5,
};
const fieldLabel: React.CSSProperties = {
  display: 'block', fontSize: 10, color: '#6B7280',
  textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4,
};
const textarea: React.CSSProperties = {
  width: '100%', padding: 10, background: '#f5f5f5', border: '1px solid #E5E7EB',
  color: '#111111', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
};
const inputField: React.CSSProperties = {
  width: '100%', padding: '8px 10px', background: '#f5f5f5', border: '1px solid #E5E7EB',
  color: '#111111', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
};
const approveBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '11px 22px', background: '#0F766E', color: '#fff',
  border: 'none', borderRadius: 0, cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
};
const rejectBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '11px 22px', background: '#EF4444', color: '#fff',
  border: 'none', borderRadius: 0, cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
};
const cancelBtn: React.CSSProperties = {
  padding: '11px 22px', background: 'transparent', color: '#6B7280',
  border: '1px solid #E5E7EB', borderRadius: 0, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit',
};
const modalOverlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
};
const modalBox: React.CSSProperties = {
  background: '#fff', border: '2px solid #111827', padding: 28, width: 480, maxWidth: '90vw',
};
