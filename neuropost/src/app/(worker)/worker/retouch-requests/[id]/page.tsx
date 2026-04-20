'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter }              from 'next/navigation';
import { ArrowLeft }                         from 'lucide-react';
import toast                                 from 'react-hot-toast';

const C = {
  border: '#E5E7EB', text: '#111111', muted: '#6B7280',
  accent: '#0F766E', red: '#EF4444', amber: '#F59E0B',
};

interface RetouchDetail {
  id:              string;
  post_id:         string;
  brand_id:        string;
  retouch_type:    'copy' | 'schedule' | 'freeform';
  original_value:  Record<string, unknown> | null;
  requested_value: Record<string, unknown> | null;
  client_comment:  string | null;
  status:          string;
  created_at:      string;
  brands:          { name: string } | null;
  posts:           { caption: string | null; image_url: string | null; scheduled_at: string | null } | null;
}

export default function RetouchDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();

  const [detail,         setDetail]         = useState<RetouchDetail | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [newCaption,     setNewCaption]     = useState('');
  const [newScheduledAt, setNewScheduledAt] = useState('');
  const [rejectReason,   setRejectReason]   = useState('');
  const [showReject,     setShowReject]     = useState(false);
  const [acting,         setActing]         = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res  = await fetch(`/api/worker/retouch-requests/pending`);
    const data = await res.json() as { requests?: RetouchDetail[] };
    const found = (data.requests ?? []).find((r: RetouchDetail) => r.id === id) ?? null;
    setDetail(found);
    if (found?.posts?.caption)     setNewCaption(found.posts.caption);
    if (found?.posts?.scheduled_at) setNewScheduledAt(found.posts.scheduled_at.slice(0, 16));
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleResolve() {
    setActing(true);
    const applyToPost: Record<string, string> = {};
    if (detail?.retouch_type === 'copy'     && newCaption)     applyToPost.caption      = newCaption;
    if (detail?.retouch_type === 'schedule' && newScheduledAt) applyToPost.scheduled_at = new Date(newScheduledAt).toISOString();

    const res = await fetch(`/api/worker/retouch-requests/${id}/resolve`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ apply_to_post: applyToPost }),
    });
    setActing(false);
    if (!res.ok) { toast.error('Error al resolver'); return; }
    toast.success('Retoque resuelto');
    router.push('/worker/validation');
  }

  async function handleReject() {
    if (!rejectReason.trim()) { toast.error('El motivo es obligatorio'); return; }
    setActing(true);
    const res = await fetch(`/api/worker/retouch-requests/${id}/reject`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ reason: rejectReason }),
    });
    setActing(false);
    if (!res.ok) { toast.error('Error al rechazar'); return; }
    toast.success('Retoque rechazado');
    router.push('/worker/validation');
  }

  if (loading) return <div style={{ padding: 40, color: C.muted }}>Cargando...</div>;
  if (!detail) return (
    <div style={{ padding: 40, color: C.muted }}>
      Retoque no encontrado.{' '}
      <button onClick={() => router.push('/worker/validation')} style={linkBtn}>Volver</button>
    </div>
  );

  const TYPE_LABEL: Record<string, string> = {
    copy: 'Cambio de texto', schedule: 'Cambio de hora', freeform: 'Retoque libre',
  };

  return (
    <div style={{ padding: 28, maxWidth: 680, color: C.text }}>
      <button onClick={() => router.push('/worker/validation')} style={backBtn}>
        <ArrowLeft size={14} /> Volver a validación
      </button>

      <div style={{ marginTop: 16, marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>
          Retoque — {TYPE_LABEL[detail.retouch_type] ?? detail.retouch_type}
        </h1>
        <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
          {detail.brands?.name ?? 'Marca desconocida'} ·{' '}
          {new Date(detail.created_at).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
      </div>

      {/* Post preview */}
      <div style={{ border: `1px solid ${C.border}`, marginBottom: 24, background: '#fafafa' }}>
        {detail.posts?.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={detail.posts.image_url} alt="" style={{ width: '100%', maxHeight: 280, objectFit: 'cover', display: 'block' }} />
        )}
        <div style={{ padding: 16 }}>
          <p style={{ fontSize: 13, color: C.text, margin: 0, whiteSpace: 'pre-wrap' }}>
            {detail.posts?.caption ?? 'Sin caption'}
          </p>
          {detail.posts?.scheduled_at && (
            <p style={{ fontSize: 12, color: C.muted, margin: '8px 0 0' }}>
              Programado: {new Date(detail.posts.scheduled_at).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          )}
        </div>
      </div>

      {/* Requested change */}
      <div style={{ border: `1px solid ${C.border}`, padding: 16, marginBottom: 24, background: '#fffbeb' }}>
        <p style={{ fontSize: 11, color: C.amber, fontWeight: 700, textTransform: 'uppercase', margin: '0 0 8px', letterSpacing: 1 }}>
          Petición del cliente
        </p>
        {detail.retouch_type === 'copy' && (
          <p style={{ fontSize: 14, margin: 0 }}>{String(detail.requested_value?.new_copy ?? '—')}</p>
        )}
        {detail.retouch_type === 'schedule' && (
          <p style={{ fontSize: 14, margin: 0 }}>
            Nueva hora: {formatDt(String(detail.requested_value?.new_scheduled_at ?? ''))}
          </p>
        )}
        {detail.retouch_type === 'freeform' && (
          <p style={{ fontSize: 14, margin: 0, fontStyle: 'italic' }}>"{detail.client_comment}"</p>
        )}
      </div>

      {/* Edit area */}
      <div style={{ marginBottom: 20 }}>
        {detail.retouch_type === 'copy' && (
          <div>
            <label style={fieldLabel}>Caption final (que se aplicará al post)</label>
            <textarea
              value={newCaption}
              onChange={(e) => setNewCaption(e.target.value)}
              rows={5}
              style={textarea}
            />
          </div>
        )}
        {detail.retouch_type === 'schedule' && (
          <div>
            <label style={fieldLabel}>Nueva fecha y hora</label>
            <input
              type="datetime-local"
              value={newScheduledAt}
              onChange={(e) => setNewScheduledAt(e.target.value)}
              style={{ ...textarea, padding: '10px 12px' }}
            />
          </div>
        )}
        {detail.retouch_type === 'freeform' && (
          <p style={{ color: C.muted, fontSize: 13 }}>
            Retoque libre — aplica los cambios manualmente en el post y luego resuelve.
          </p>
        )}
      </div>

      {/* Action buttons */}
      {!showReject ? (
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleResolve} disabled={acting} style={resolveBtn}>
            {acting ? 'Guardando…' : 'Aplicar cambios y resolver'}
          </button>
          <button onClick={() => setShowReject(true)} style={rejectBtnOutline}>
            Rechazar
          </button>
        </div>
      ) : (
        <div style={{ border: `1px solid ${C.red}`, padding: 16 }}>
          <label style={{ ...fieldLabel, color: C.red }}>Motivo del rechazo</label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            style={{ ...textarea, marginBottom: 12 }}
            placeholder="El post ya fue publicado / No es posible aplicar este cambio..."
            autoFocus
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleReject} disabled={acting} style={rejectBtnFull}>
              {acting ? 'Guardando…' : 'Confirmar rechazo'}
            </button>
            <button onClick={() => setShowReject(false)} style={cancelBtn}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDt(iso: string): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return iso; }
}

const backBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '6px 12px', background: 'transparent', border: `1px solid ${C.border}`,
  color: C.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
};
const linkBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 13,
  textDecoration: 'underline', fontFamily: 'inherit',
};
const fieldLabel: React.CSSProperties = {
  display: 'block', fontSize: 10, color: C.muted,
  textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6,
};
const textarea: React.CSSProperties = {
  width: '100%', padding: 10, background: '#f5f5f5', border: `1px solid ${C.border}`,
  color: C.text, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
};
const resolveBtn: React.CSSProperties = {
  padding: '11px 22px', background: C.accent, color: '#fff',
  border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
};
const rejectBtnOutline: React.CSSProperties = {
  padding: '11px 18px', background: 'transparent', color: C.red,
  border: `1px solid ${C.red}`, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
};
const rejectBtnFull: React.CSSProperties = {
  padding: '10px 18px', background: C.red, color: '#fff',
  border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
};
const cancelBtn: React.CSSProperties = {
  padding: '10px 16px', background: 'transparent', color: C.muted,
  border: `1px solid ${C.border}`, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
};
