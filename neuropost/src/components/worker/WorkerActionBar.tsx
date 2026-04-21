'use client';

import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { WORKER_FONT as f, WORKER_FONT_CONDENSED as fc } from './theme';
import type { BriefDraft, PostRevision } from './cockpit-types';

type Props = {
  postId: string;
  draft: BriefDraft;
  selectedRevision: PostRevision | null;
  onSuccess: () => void;
};

export function WorkerActionBar({ postId, draft, selectedRevision, onSuccess }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading]           = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [reanalyzeNote, setReanalyzeNote] = useState('');
  const [showReject, setShowReject]     = useState(false);
  const [showReanalyze, setShowReanalyze] = useState(false);

  async function post<T = unknown>(path: string, body: unknown): Promise<T> {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as T & { error?: string };
    if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
    return data;
  }

  async function handleRegenerate() {
    if (!draft.prompt.trim()) { toast.error('El prompt es obligatorio'); return; }
    setLoading('regen');
    try {
      await post(`/api/worker/posts/${postId}/regenerate`, {
        prompt:            draft.prompt,
        negative_prompt:   draft.negative_prompt || undefined,
        edit_strength:     draft.edit_strength,
        guidance:          draft.guidance,
        num_outputs:       draft.num_outputs,
        model:             draft.model,
        primary_image_url: draft.primary_image_url || null,
      });
      toast.success('Generación encolada');
      onSuccess();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al regenerar');
    } finally { setLoading(null); }
  }

  async function handleManualUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading('upload');
    try {
      const form = new FormData();
      form.append('image', file);
      const res = await fetch(`/api/worker/posts/${postId}/manual-upload`, { method: 'POST', body: form });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      toast.success('Imagen subida correctamente');
      onSuccess();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al subir');
    } finally {
      setLoading(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleApprove() {
    if (!selectedRevision) { toast.error('Selecciona una revisión primero'); return; }
    if (!selectedRevision.image_url) { toast.error('La revisión no tiene imagen todavía'); return; }
    setLoading('approve');
    try {
      await post(`/api/worker/posts/${postId}/approve`, { revision_id: selectedRevision.id });
      toast.success('Post aprobado — enviado a revisión del cliente');
      onSuccess();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al aprobar');
    } finally { setLoading(null); }
  }

  async function handleReject() {
    if (rejectReason.trim().length < 10) { toast.error('El motivo debe tener al menos 10 caracteres'); return; }
    setLoading('reject');
    try {
      await post(`/api/worker/posts/${postId}/reject`, { reason: rejectReason.trim() });
      toast.success('Post rechazado');
      setShowReject(false);
      setRejectReason('');
      onSuccess();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al rechazar');
    } finally { setLoading(null); }
  }

  async function handleReanalyze() {
    setLoading('reanalyze');
    try {
      await post(`/api/worker/posts/${postId}/reanalyze`, { worker_feedback: reanalyzeNote.trim() });
      toast.success('Brief re-analizado');
      setShowReanalyze(false);
      setReanalyzeNote('');
      onSuccess();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al re-analizar');
    } finally { setLoading(null); }
  }

  const busy = loading !== null;

  const actionBtn = (
    label: string,
    onClick: () => void,
    opts: { bg?: string; color?: string; border?: string; disabled?: boolean; active?: boolean } = {},
  ) => (
    <button
      onClick={onClick}
      disabled={busy || opts.disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '9px 16px',
        background: opts.bg ?? '#f3f4f6',
        border: `1px solid ${opts.border ?? opts.color ?? '#e5e7eb'}`,
        color: opts.color ?? '#374151',
        fontSize: 12, fontWeight: 700, fontFamily: f,
        cursor: busy || opts.disabled ? 'not-allowed' : 'pointer',
        opacity: busy || opts.disabled ? 0.55 : 1,
        whiteSpace: 'nowrap' as const,
        outline: opts.active ? `2px solid ${opts.color}` : 'none',
        outlineOffset: 1,
      }}
    >
      {loading === label ? '…' : label}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Main action row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {actionBtn(
          loading === 'regen' ? '…' : '⚡ Regenerar',
          handleRegenerate,
          { bg: '#0F766E', color: '#fff', border: '#0D9488' },
        )}

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '9px 16px', background: '#f3f4f6', border: '1px solid #e5e7eb',
            color: '#374151', fontSize: 12, fontWeight: 700, fontFamily: f,
            cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.55 : 1,
            whiteSpace: 'nowrap' as const,
          }}
        >
          {loading === 'upload' ? '…' : '↑ Subir manual'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleManualUpload}
        />

        {actionBtn(
          loading === 'approve' ? '…' : '✓ Aprobar',
          handleApprove,
          {
            bg: selectedRevision?.image_url ? '#065f46' : '#f3f4f6',
            color: selectedRevision?.image_url ? '#fff' : '#9ca3af',
            border: selectedRevision?.image_url ? '#047857' : '#e5e7eb',
            disabled: !selectedRevision?.image_url,
          },
        )}

        <button
          onClick={() => { setShowReject(!showReject); setShowReanalyze(false); }}
          disabled={busy}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '9px 16px',
            background: showReject ? '#fef2f2' : '#f3f4f6',
            border: `1px solid ${showReject ? '#fca5a5' : '#e5e7eb'}`,
            color: '#ef4444', fontSize: 12, fontWeight: 700, fontFamily: f,
            cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.55 : 1,
            whiteSpace: 'nowrap' as const,
          }}
        >
          ✗ Rechazar
        </button>

        <button
          onClick={() => { setShowReanalyze(!showReanalyze); setShowReject(false); }}
          disabled={busy}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '9px 16px',
            background: showReanalyze ? '#eff6ff' : '#f3f4f6',
            border: `1px solid ${showReanalyze ? '#bfdbfe' : '#e5e7eb'}`,
            color: '#3b82f6', fontSize: 12, fontWeight: 700, fontFamily: f,
            cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.55 : 1,
            whiteSpace: 'nowrap' as const,
          }}
        >
          ↺ Re-analizar
        </button>
      </div>

      {/* Reject inline form */}
      {showReject && (
        <div style={{
          border: '1px solid #fca5a5', background: '#fef2f2',
          padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <label style={{
            fontSize: 11, fontWeight: 700, color: '#991b1b',
            fontFamily: fc, letterSpacing: '0.04em', textTransform: 'uppercase' as const,
          }}>
            MOTIVO DE RECHAZO (mín. 10 caracteres)
          </label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={2}
            style={{
              width: '100%', padding: '8px 10px',
              border: '1px solid #fca5a5', background: '#fff',
              color: '#111', fontSize: 13, fontFamily: f,
              resize: 'vertical', boxSizing: 'border-box', borderRadius: 0,
            }}
            placeholder="¿Por qué se rechaza este post?"
          />
          <button
            onClick={handleReject}
            disabled={rejectReason.trim().length < 10 || loading === 'reject'}
            style={{
              alignSelf: 'flex-end', padding: '7px 18px',
              background: '#ef4444', color: '#fff',
              border: 'none', fontSize: 12, fontWeight: 700, fontFamily: f,
              cursor: rejectReason.trim().length < 10 ? 'not-allowed' : 'pointer',
              opacity: rejectReason.trim().length < 10 ? 0.5 : 1,
            }}
          >
            {loading === 'reject' ? '…' : 'Confirmar rechazo'}
          </button>
        </div>
      )}

      {/* Reanalyze inline form */}
      {showReanalyze && (
        <div style={{
          border: '1px solid #bfdbfe', background: '#eff6ff',
          padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <label style={{
            fontSize: 11, fontWeight: 700, color: '#1d4ed8',
            fontFamily: fc, letterSpacing: '0.04em', textTransform: 'uppercase' as const,
          }}>
            NOTA PARA EL AGENTE (opcional)
          </label>
          <textarea
            value={reanalyzeNote}
            onChange={(e) => setReanalyzeNote(e.target.value)}
            rows={2}
            style={{
              width: '100%', padding: '8px 10px',
              border: '1px solid #bfdbfe', background: '#fff',
              color: '#111', fontSize: 13, fontFamily: f,
              resize: 'vertical', boxSizing: 'border-box', borderRadius: 0,
            }}
            placeholder="Ej: Más dramático, colores vibrantes, evita texto en imagen…"
          />
          <button
            onClick={handleReanalyze}
            disabled={loading === 'reanalyze'}
            style={{
              alignSelf: 'flex-end', padding: '7px 18px',
              background: '#3b82f6', color: '#fff',
              border: 'none', fontSize: 12, fontWeight: 700, fontFamily: f,
              cursor: 'pointer',
            }}
          >
            {loading === 'reanalyze' ? '…' : 'Re-analizar brief'}
          </button>
        </div>
      )}
    </div>
  );
}
