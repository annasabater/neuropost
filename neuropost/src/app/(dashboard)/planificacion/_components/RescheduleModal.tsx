'use client';

import { useState } from 'react';
import { X }        from 'lucide-react';
import toast        from 'react-hot-toast';

const C = {
  border: '#E5E7EB', text: '#111111', muted: '#6B7280', accent: '#0F766E',
};

interface Props {
  postId:      string;
  currentAt:   string | null;
  weekStart:   string;  // YYYY-MM-DD Monday of the week (UTC)
  otherPostsAt: string[]; // ISO strings of sibling posts (for collision warning)
  onClose:     () => void;
  onSuccess:   () => void;
}

export function RescheduleModal({ postId, currentAt, weekStart, otherPostsAt, onClose, onSuccess }: Props) {
  const initValue = currentAt ? currentAt.slice(0, 16) : '';
  const [newAt,       setNewAt]       = useState(initValue);
  const [reason,      setReason]      = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [warning,     setWarning]     = useState<string | null>(null);

  const weekEnd = (() => {
    const d = new Date(weekStart + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + 6);
    return d.toISOString().slice(0, 10);
  })();

  function handleDateChange(val: string) {
    setNewAt(val);
    if (!val) { setWarning(null); return; }
    const dt = new Date(val);
    if (isNaN(dt.getTime())) { setWarning(null); return; }
    if (dt <= new Date()) {
      setWarning('La fecha seleccionada ya ha pasado.');
      return;
    }
    const collision = otherPostsAt.some((iso) => Math.abs(new Date(iso).getTime() - dt.getTime()) < 60_000);
    setWarning(collision ? 'Otro post ya está programado a esa hora. Elige otra.' : null);
  }

  async function submit() {
    if (!newAt) { toast.error('Selecciona una fecha y hora'); return; }
    const dt = new Date(newAt);
    if (dt <= new Date()) { toast.error('La fecha debe estar en el futuro'); return; }
    if (warning) { toast.error(warning); return; }

    setSubmitting(true);
    const res = await fetch(`/api/client/posts/${postId}/reschedule`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ new_scheduled_at: dt.toISOString(), change_reason: reason || undefined }),
    });
    setSubmitting(false);

    if (!res.ok) {
      const d = await res.json() as { error?: string };
      toast.error(d.error ?? 'Error al reprogramar');
      return;
    }

    toast.success('Post reprogramado correctamente');
    onSuccess();
    onClose();
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={box} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Reprogramar publicación</h3>
          <button onClick={onClose} style={iconBtn}><X size={16} /></button>
        </div>

        {/* Current */}
        {currentAt && (
          <p style={{ fontSize: 13, color: C.muted, margin: '0 0 16px' }}>
            Fecha actual:{' '}
            <strong style={{ color: C.text }}>
              {new Date(currentAt).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}
            </strong>
          </p>
        )}

        {/* Date picker */}
        <div style={{ marginBottom: 16 }}>
          <label style={fieldLabel}>Nueva fecha y hora</label>
          <input
            type="datetime-local"
            value={newAt}
            min={new Date().toISOString().slice(0, 16)}
            onChange={(e) => handleDateChange(e.target.value)}
            style={{ ...inputStyle, borderColor: warning ? '#ef4444' : C.border }}
          />
          {warning && (
            <p style={{ fontSize: 12, color: '#ef4444', margin: '4px 0 0' }}>{warning}</p>
          )}
          <p style={{ fontSize: 11, color: C.muted, margin: '4px 0 0' }}>
            Semana del {formatWeek(weekStart)} al {formatWeek(weekEnd)}
          </p>
        </div>

        {/* Reason */}
        <div style={{ marginBottom: 20 }}>
          <label style={fieldLabel}>Razón del cambio (opcional)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            style={textarea}
            placeholder="Ej: la hora original coincide con otro evento..."
          />
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={cancelBtn}>Cancelar</button>
          <button
            onClick={submit}
            disabled={submitting || !!warning}
            style={{ ...submitBtn, opacity: submitting || !!warning ? 0.6 : 1 }}
          >
            {submitting ? 'Guardando…' : 'Guardar cambio'}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
};
const box: React.CSSProperties = {
  background: '#fff', border: '2px solid #111827', padding: 28,
  width: 480, maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto',
};
const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: C.muted,
};
const fieldLabel: React.CSSProperties = {
  display: 'block', fontSize: 10, color: C.muted,
  textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6,
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', background: '#f5f5f5',
  border: '1px solid #E5E7EB', color: C.text, fontSize: 13,
  fontFamily: 'inherit', boxSizing: 'border-box',
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
