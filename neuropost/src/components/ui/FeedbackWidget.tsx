'use client';

import { useState, useEffect } from 'react';

export function FeedbackWidget() {
  const [open, setOpen]           = useState(false);
  const [rating, setRating]       = useState(0);
  const [hovered, setHovered]     = useState(0);
  const [message, setMessage]     = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [pulsing, setPulsing]     = useState(true);

  // Stop pulsing once opened for the first time
  useEffect(() => {
    if (open) setPulsing(false);
  }, [open]);

  async function handleSubmit() {
    if (!rating) return;
    setLoading(true);
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, message, page: window.location.pathname }),
      });
      setSubmitted(true);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setOpen(false);
    // reset state after closing
    setTimeout(() => {
      setSubmitted(false);
      setRating(0);
      setHovered(0);
      setMessage('');
    }, 300);
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '80px',
      right: '24px',
      zIndex: 200,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: '12px',
    }}>
      {/* Popup card */}
      {open && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '20px',
          width: '280px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{
              fontFamily: "'Cabinet Grotesk', sans-serif",
              fontWeight: 800,
              fontSize: '1rem',
              color: 'var(--ink)',
            }}>
              Cuéntanos
            </span>
            <button
              onClick={handleClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--muted)',
                fontSize: '1.1rem',
                lineHeight: 1,
                padding: '4px',
              }}
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>

          {submitted ? (
            <p style={{
              fontFamily: "'Cabinet Grotesk', sans-serif",
              color: 'var(--ink)',
              fontSize: '0.95rem',
              textAlign: 'center',
              padding: '12px 0',
              lineHeight: 1.5,
            }}>
              ¡Gracias! Tu opinión nos ayuda mucho.
            </p>
          ) : (
            <>
              {/* Stars */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', justifyContent: 'center' }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onMouseEnter={() => setHovered(star)}
                    onMouseLeave={() => setHovered(0)}
                    onClick={() => setRating(star)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '1.6rem',
                      color: star <= (hovered || rating) ? '#f5a623' : 'var(--border)',
                      transition: 'color 0.1s',
                      padding: '2px',
                    }}
                    aria-label={`${star} estrellas`}
                  >
                    ★
                  </button>
                ))}
              </div>

              {/* Textarea */}
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="¿Qué podría mejorar?"
                rows={3}
                style={{
                  width: '100%',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  padding: '10px 12px',
                  fontFamily: "'Cabinet Grotesk', sans-serif",
                  fontSize: '0.88rem',
                  color: 'var(--ink)',
                  background: 'var(--cream)',
                  resize: 'none',
                  outline: 'none',
                  marginBottom: '12px',
                  lineHeight: 1.5,
                }}
              />

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={!rating || loading}
                style={{
                  width: '100%',
                  background: !rating ? 'var(--border)' : 'var(--orange)',
                  color: !rating ? 'var(--muted)' : '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  fontFamily: "'Cabinet Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: !rating ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                {loading ? 'Enviando…' : 'Enviar →'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          background: 'var(--ink)',
          color: 'var(--cream)',
          border: 'none',
          borderRadius: '24px',
          padding: '10px 18px',
          fontFamily: "'Cabinet Grotesk', sans-serif",
          fontWeight: 700,
          fontSize: '0.85rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          animation: pulsing ? 'feedbackPulse 2.5s ease-in-out infinite' : 'none',
        }}
      >
        <span>💬</span>
        ¿Algo que mejorar?
      </button>

      <style>{`
        @keyframes feedbackPulse {
          0%, 100% { box-shadow: 0 4px 16px rgba(0,0,0,0.18); }
          50%       { box-shadow: 0 4px 24px rgba(15,118,110,0.45); }
        }
      `}</style>
    </div>
  );
}
