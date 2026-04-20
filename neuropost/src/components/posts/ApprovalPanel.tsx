'use client';

import { useState } from 'react';
import { Check, X, Clock, Send, RefreshCw, Type, Star } from 'lucide-react';
import type { Post } from '@/types';

// Best-time recommendations per sector/platform (heuristic)
const BEST_TIMES = [
  { label: 'Mañana temprano',  time: '09:00', reason: 'Mayor actividad antes del trabajo' },
  { label: 'Mediodía',         time: '13:00', reason: 'Pausa de almuerzo — alta apertura' },
  { label: 'Tarde',            time: '18:00', reason: 'Después del trabajo — pico de engagement' },
  { label: 'Noche',            time: '20:30', reason: 'Momento de ocio — máximo alcance' },
];

interface Props {
  post:        Post;
  onApprove:   (postId: string) => Promise<void>;
  onReject:    (postId: string) => Promise<void>;
  onSchedule:  (postId: string, scheduledAt: string) => Promise<void>;
  onPublish:   (postId: string) => Promise<void>;
  onRegenerate?: (postId: string) => Promise<void>;
}

export function ApprovalPanel({ post, onApprove, onReject, onSchedule, onPublish, onRegenerate }: Props) {
  const [loading, setLoading]           = useState<string | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('18:00');

  async function handle(action: 'approve' | 'reject' | 'schedule' | 'publish' | 'regenerate') {
    setLoading(action);
    try {
      if (action === 'approve')    await onApprove(post.id);
      if (action === 'reject')     await onReject(post.id);
      if (action === 'publish')    await onPublish(post.id);
      if (action === 'regenerate') await onRegenerate?.(post.id);
      if (action === 'schedule') {
        if (!scheduleDate) return;
        const iso = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();
        await onSchedule(post.id, iso);
        setShowSchedule(false);
      }
    } finally {
      setLoading(null);
    }
  }

  const isPending  = post.status === 'pending' || post.status === 'generated';
  const isApproved = post.status === 'approved';
  const isPublished = post.status === 'published';

  const qs = post.quality_score;
  const qsColor = qs == null ? 'var(--muted)'
    : qs >= 8 ? 'var(--accent)'
    : qs >= 6 ? 'var(--warning)'
    : 'var(--error)';

  return (
    <div className="approval-panel">
      {/* Quality score — prominent */}
      {qs != null && (
        <div style={{
          display:      'flex',
          alignItems:   'center',
          gap:          10,
          padding:      '10px 14px',
          borderRadius: 10,
          background:   qs >= 8 ? 'var(--accent-bg)' : qs >= 6 ? 'var(--warning-dim)' : 'var(--error-dim)',
          border:       `1px solid var(--border)`,
          marginBottom: 14,
        }}>
          <Star size={16} fill={qsColor} color={qsColor} />
          <span style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, color: qsColor, fontSize: '0.9rem' }}>
            Calidad IA: {qs}/10
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
            {qs >= 8 ? 'Excelente — listo para publicar' : qs >= 6 ? 'Bueno — considera revisar' : 'Mejorable — regenera el contenido'}
          </span>
        </div>
      )}

      {/* AI Explanation */}
      {post.ai_explanation && (
        <div style={{
          padding:      '10px 14px',
          background:   'var(--surface)',
          borderRadius: 10,
          border:       '1px solid var(--border)',
          marginBottom: 14,
          fontSize:     '0.82rem',
          color:        'var(--ink)',
          lineHeight:   1.6,
        }}>
          <strong style={{ display: 'block', marginBottom: 4, fontSize: '0.78rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Por qué generé este contenido
          </strong>
          {post.ai_explanation}
        </div>
      )}

      <div className="approval-status-row">
        <span className={`status-badge status-${post.status}`}>{post.status}</span>
      </div>

      {/* Actions */}
      <div className="approval-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
        {isPending && (
          <>
            <button
              className="btn-primary"
              disabled={loading !== null}
              onClick={() => handle('approve')}
              title="Aprobar el post — pasará a estado 'aprobado'"
            >
              <Check size={16} />
              {loading === 'approve' ? 'Aprobando…' : 'Aprobar'}
            </button>
            <button
              className="btn-outline"
              disabled={loading !== null}
              onClick={() => handle('reject')}
              title="Rechazar y archivar este post"
            >
              <X size={16} />
              {loading === 'reject' ? 'Rechazando…' : 'Rechazar'}
            </button>
            {onRegenerate && (
              <button
                className="btn-outline"
                disabled={loading !== null}
                onClick={() => handle('regenerate')}
                title="Regenerar el texto del post (se guarda la versión actual)"
                style={{ color: 'var(--orange)', borderColor: 'var(--orange)' }}
              >
                <RefreshCw size={15} />
                {loading === 'regenerate' ? 'Regenerando…' : 'Regenerar texto'}
              </button>
            )}
          </>
        )}

        {isApproved && (
          <>
            <button
              className="btn-primary btn-orange"
              disabled={loading !== null}
              onClick={() => handle('publish')}
            >
              <Send size={16} />
              {loading === 'publish' ? 'Publicando…' : 'Publicar ahora'}
            </button>
            <button
              className="btn-outline"
              disabled={loading !== null}
              onClick={() => setShowSchedule((v) => !v)}
            >
              <Clock size={16} />
              Programar
            </button>
            {onRegenerate && (
              <button
                className="btn-outline"
                disabled={loading !== null}
                onClick={() => handle('regenerate')}
                title="Modificar el texto antes de publicar"
              >
                <Type size={15} />
                {loading === 'regenerate' ? 'Regenerando…' : 'Cambiar texto'}
              </button>
            )}
          </>
        )}

        {isPublished && (
          <p style={{ fontSize: '0.85rem', color: 'var(--accent)', fontWeight: 600 }}>
            ✓ Publicado correctamente
          </p>
        )}
      </div>

      {/* Schedule picker with best-time suggestions */}
      {showSchedule && (
        <div className="schedule-picker" style={{ marginTop: 14 }}>
          {/* Best time chips */}
          <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Horarios recomendados
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {BEST_TIMES.map((bt) => (
              <button
                key={bt.time}
                type="button"
                onClick={() => setScheduleTime(bt.time)}
                title={bt.reason}
                style={{
                  padding:      '5px 10px',
                  borderRadius: 6,
                  border:       `1px solid ${scheduleTime === bt.time ? 'var(--orange)' : 'var(--border)'}`,
                  background:   scheduleTime === bt.time ? 'var(--orange-light)' : 'var(--surface)',
                  fontSize:     '0.78rem',
                  fontFamily:   "'Cabinet Grotesk', sans-serif",
                  fontWeight:   600,
                  cursor:       'pointer',
                  color:        scheduleTime === bt.time ? 'var(--orange)' : 'var(--ink)',
                }}
              >
                {bt.time} · {bt.label}
              </button>
            ))}
          </div>

          <div className="schedule-picker-row">
            <input
              type="date"
              value={scheduleDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="schedule-input"
              aria-label="Fecha de programación"
              title="Fecha de programación"
              placeholder="Selecciona una fecha"
            />
            <input
              type="time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              className="schedule-input"
              aria-label="Hora de programación"
              title="Hora de programación"
              placeholder="Selecciona una hora"
            />
            <button
              className="btn-primary btn-orange"
              disabled={!scheduleDate || loading === 'schedule'}
              onClick={() => handle('schedule')}
            >
              {loading === 'schedule' ? 'Guardando…' : 'Confirmar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}