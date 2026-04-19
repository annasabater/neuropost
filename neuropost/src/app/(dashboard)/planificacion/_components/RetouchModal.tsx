'use client';

import { useState } from 'react';
import { X }        from 'lucide-react';
import toast        from 'react-hot-toast';

const C = {
  border: '#E5E7EB', text: '#111111', muted: '#6B7280',
  accent: '#0F766E', red: '#EF4444',
};

type RetouchType = 'copy' | 'schedule' | 'freeform';

interface Props {
  postId:       string;
  currentCopy:  string | null;
  currentAt:    string | null;
  onClose:      () => void;
  onSuccess:    () => void;
}

export function RetouchModal({ postId, currentCopy, currentAt, onClose, onSuccess }: Props) {
  const [tab,         setTab]         = useState<RetouchType>('copy');
  const [newCopy,     setNewCopy]     = useState(currentCopy ?? '');
  const [newAt,       setNewAt]       = useState(currentAt ? currentAt.slice(0, 16) : '');
  const [comment,     setComment]     = useState('');
  const [submitting,  setSubmitting]  = useState(false);

  async function submit() {
    setSubmitting(true);

    const body: {
      retouch_type:     RetouchType;
      requested_value?: { new_copy?: string; new_scheduled_at?: string };
      client_comment?:  string;
    } = { retouch_type: tab };

    if (tab === 'copy')     body.requested_value = { new_copy: newCopy };
    if (tab === 'schedule') body.requested_value = { new_scheduled_at: newAt ? new Date(newAt).toISOString() : undefined };
    if (tab === 'freeform') body.client_comment  = comment;

    const res = await fetch(`/api/client/posts/${postId}/retouch`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });

    setSubmitting(false);

    if (!res.ok) {
      const d = await res.json() as { error?: string };
      toast.error(d.error ?? 'Error al enviar retoque');
      return;
    }

    toast.success('Tu petición se envió. La resolveremos en 24h.');
    onSuccess();
    onClose();
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={box} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Pedir retoque</h3>
          <button onClick={onClose} style={iconBtn}><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `2px solid ${C.border}`, marginBottom: 20, gap: 0 }}>
          {([
            ['copy',     'Cambiar texto'],
            ['schedule', 'Cambiar hora'],
            ['freeform', 'Otro retoque'],
          ] as [RetouchType, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '9px 16px', background: 'none', border: 'none',
              borderBottom: tab === t ? `2px solid ${C.accent}` : '2px solid transparent',
              marginBottom: -2, color: tab === t ? C.accent : C.muted,
              fontWeight: tab === t ? 700 : 400, fontSize: 13,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'copy' && (
          <div>
            <label style={fieldLabel}>Nuevo texto</label>
            <textarea
              value={newCopy}
              onChange={(e) => setNewCopy(e.target.value)}
              rows={5}
              style={textarea}
              placeholder="Escribe el texto que quieres para este post..."
            />
          </div>
        )}

        {tab === 'schedule' && (
          <div>
            <label style={fieldLabel}>Nueva fecha y hora</label>
            {currentAt && (
              <p style={{ fontSize: 12, color: C.muted, margin: '0 0 8px' }}>
                Hora actual: {new Date(currentAt).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            )}
            <input
              type="datetime-local"
              value={newAt}
              onChange={(e) => setNewAt(e.target.value)}
              style={{ ...textarea, padding: '10px 12px' }}
            />
          </div>
        )}

        {tab === 'freeform' && (
          <div>
            <label style={fieldLabel}>Cuéntanos qué quieres cambiar</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={5}
              style={textarea}
              placeholder="Describe el cambio que necesitas..."
            />
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={cancelBtn}>Cancelar</button>
          <button
            onClick={submit}
            disabled={submitting}
            style={{ ...submitBtn, opacity: submitting ? 0.6 : 1 }}
          >
            {submitting ? 'Enviando…' : 'Enviar petición'}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
};
const box: React.CSSProperties = {
  background: '#fff', border: '2px solid #111827', padding: 28,
  width: 520, maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto',
};
const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: C.muted,
};
const fieldLabel: React.CSSProperties = {
  display: 'block', fontSize: 10, color: C.muted,
  textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6,
};
const textarea: React.CSSProperties = {
  width: '100%', padding: 10, background: '#f5f5f5', border: `1px solid ${C.border}`,
  color: C.text, fontSize: 13, fontFamily: 'inherit', resize: 'vertical',
  boxSizing: 'border-box',
};
const cancelBtn: React.CSSProperties = {
  padding: '10px 18px', background: 'transparent', color: C.muted,
  border: `1px solid ${C.border}`, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
};
const submitBtn: React.CSSProperties = {
  padding: '10px 20px', background: C.accent, color: '#fff',
  border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
};
