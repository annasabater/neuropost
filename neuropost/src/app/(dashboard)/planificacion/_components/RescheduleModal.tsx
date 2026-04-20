'use client';

import { useState } from 'react';
import { X }        from 'lucide-react';
import toast        from 'react-hot-toast';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

interface Props {
  postId:       string;
  currentAt:    string | null;
  weekStart:    string;   // YYYY-MM-DD Monday of the week (UTC)
  otherPostsAt: string[]; // ISO strings of sibling posts (for collision warning)
  onClose:      () => void;
  onSuccess:    () => void;
}

export function RescheduleModal({ postId, currentAt, weekStart, otherPostsAt, onClose, onSuccess }: Props) {
  const initValue = currentAt ? currentAt.slice(0, 16) : '';
  const [newAt,      setNewAt]      = useState(initValue);
  const [reason,     setReason]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [warning,    setWarning]    = useState<string | null>(null);

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
          <h3 style={{
            fontFamily: fc, fontWeight: 900, fontSize: 20,
            textTransform: 'uppercase', letterSpacing: '0.03em',
            color: 'var(--text-primary)', margin: 0,
          }}>
            Reprogramar publicación
          </h3>
          <button type="button" onClick={onClose} style={iconBtn}><X size={16} /></button>
        </div>

        {/* Current date info */}
        {currentAt && (
          <div style={{
            padding: '10px 14px', background: 'var(--bg-1)',
            border: '1px solid var(--border)', marginBottom: 20,
            fontSize: 13, color: 'var(--text-secondary)',
          }}>
            Fecha actual:{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {new Date(currentAt).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}
            </strong>
          </div>
        )}

        {/* Date picker */}
        <div style={{ marginBottom: 16 }}>
          <label style={fieldLabel}>Nueva fecha y hora</label>
          <input
            type="datetime-local"
            value={newAt}
            min={new Date().toISOString().slice(0, 16)}
            onChange={(e) => handleDateChange(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px',
              background: 'var(--bg-1)',
              border: `1px solid ${warning ? '#ef4444' : 'var(--border)'}`,
              color: 'var(--text-primary)', fontSize: 13,
              fontFamily: f, boxSizing: 'border-box' as const,
            }}
          />
          {warning && (
            <p style={{ fontSize: 12, color: '#ef4444', margin: '4px 0 0' }}>{warning}</p>
          )}
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
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
          <button type="button" onClick={onClose} style={cancelBtn}>Cancelar</button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !!warning}
            style={{
              padding: '10px 20px', background: 'var(--accent)', color: '#fff',
              border: 'none', cursor: submitting || !!warning ? 'default' : 'pointer',
              fontSize: 13, fontWeight: 700,
              fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.04em',
              opacity: submitting || !!warning ? 0.5 : 1,
            }}
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
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
};
const box: React.CSSProperties = {
  background: 'var(--bg)', border: '1px solid var(--border)',
  padding: 28, width: 480, maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto',
  fontFamily: f,
};
const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', padding: 4,
  color: 'var(--text-secondary)',
};
const fieldLabel: React.CSSProperties = {
  display: 'block', fontSize: 10, color: 'var(--text-secondary)',
  textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, fontFamily: f,
};
const textarea: React.CSSProperties = {
  width: '100%', padding: 10,
  background: 'var(--bg-1)', border: '1px solid var(--border)',
  color: 'var(--text-primary)', fontSize: 13, fontFamily: f,
  resize: 'vertical', boxSizing: 'border-box',
};
const cancelBtn: React.CSSProperties = {
  padding: '10px 18px', background: 'transparent', color: 'var(--text-secondary)',
  border: '1px solid var(--border)', cursor: 'pointer', fontSize: 13, fontFamily: f,
};
