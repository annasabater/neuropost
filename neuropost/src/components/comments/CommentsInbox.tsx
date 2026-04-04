'use client';

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import type { Interaction, InteractionResponse } from '@/types';

interface Props {
  interactions: Interaction[];
  responses:    InteractionResponse[];
  loading:      boolean;
  onProcess:    () => void;
}

const SENTIMENT_CLASS: Record<string, string> = {
  positive: 'sentiment-positive',
  neutral:  'sentiment-neutral',
  negative: 'sentiment-negative',
};

const SENTIMENT_LABEL: Record<string, string> = {
  positive: 'Positivo',
  neutral:  'Neutro',
  negative: 'Negativo',
};

export function CommentsInbox({ interactions, responses, loading, onProcess }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const responseMap = new Map(responses.map((r) => [r.interactionId, r]));

  return (
    <div className="community-list">
      {interactions.map((interaction) => {
        const response = responseMap.get(interaction.id);
        const isExpanded = expanded === interaction.id;
        const sentiment  = response?.analysis.sentiment;
        const isEscalated = response?.analysis.decision === 'escalate';

        return (
          <div
            key={interaction.id}
            className="interaction-card"
            onClick={() => setExpanded(isExpanded ? null : interaction.id)}
            style={{ cursor: 'pointer' }}
          >
            <div className="interaction-meta">
              <span className="interaction-author">{interaction.authorName}</span>
              <span className="interaction-platform">{interaction.platform}</span>
              <span className="interaction-platform" style={{ background: 'var(--warm)' }}>{interaction.type}</span>
              {sentiment && (
                <span className={`sentiment-badge ${SENTIMENT_CLASS[sentiment] ?? ''}`}>
                  {SENTIMENT_LABEL[sentiment]}
                </span>
              )}
              {isEscalated && (
                <span className="escalated-tag">
                  <AlertCircle size={11} /> Escalar
                </span>
              )}
              <span className="post-list-date" style={{ marginLeft: 'auto' }}>
                {new Date(interaction.timestamp).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <p className="interaction-text">{interaction.text}</p>

            {isExpanded && response && (
              <>
                {response.generatedReply && (
                  <div className="interaction-reply">
                    <strong>Respuesta IA:</strong> {response.generatedReply}
                    {response.replyPosted && <span style={{ color: 'var(--green)', marginLeft: 8, fontSize: '0.78rem', fontWeight: 700 }}>✓ Publicada</span>}
                  </div>
                )}
                {response.analysis.escalationReason && (
                  <p style={{ marginTop: 8, fontSize: '0.82rem', color: '#cc2200' }}>
                    Motivo de escalada: {response.analysis.escalationReason}
                  </p>
                )}
                <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {response.analysis.keywords.map((k) => (
                    <span key={k} className="tag-chip">{k}</span>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}

      {interactions.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">💬</div>
          <p className="empty-state-title">Sin interacciones</p>
          <p className="empty-state-sub">Aquí aparecerán los comentarios y mensajes de tus redes sociales</p>
          <button className="btn-primary btn-orange" onClick={onProcess} disabled={loading}>
            {loading ? 'Cargando…' : 'Procesar demo'}
          </button>
        </div>
      )}
    </div>
  );
}
