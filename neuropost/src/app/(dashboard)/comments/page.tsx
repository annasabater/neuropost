'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Zap } from 'lucide-react';
import type { Interaction, InteractionResponse, CommunitySummary, CommunityOutput } from '@/types';
import { CommentsInbox } from '@/components/comments/CommentsInbox';

const DEMO_INTERACTIONS: Interaction[] = [
  { id: 'i1', type: 'comment', platform: 'instagram', authorId: 'u1', authorName: 'María García', text: '¡Me encanta vuestro nuevo producto! ¿Cuándo lo tendréis disponible online?', timestamp: new Date(Date.now() - 3600000).toISOString() },
  { id: 'i2', type: 'comment', platform: 'facebook',  authorId: 'u2', authorName: 'Carlos López', text: 'Llevo esperando el pedido 2 semanas y nadie me responde. Muy mal servicio.', timestamp: new Date(Date.now() - 7200000).toISOString() },
  { id: 'i3', type: 'dm',      platform: 'instagram', authorId: 'u3', authorName: 'Ana Martín',   text: 'Hola! ¿Hacéis envíos a Canarias? Muchas gracias', timestamp: new Date(Date.now() - 10800000).toISOString() },
  { id: 'i4', type: 'comment', platform: 'instagram', authorId: 'u4', authorName: 'Pedro Ruiz',   text: 'El mejor sitio de la ciudad sin duda 🙌🏼🔥', timestamp: new Date(Date.now() - 14400000).toISOString() },
  { id: 'i5', type: 'comment', platform: 'facebook',  authorId: 'u5', authorName: 'Lucía Sanz',   text: 'Pregunta: ¿tenéis opción vegetariana en el menú del mediodía?', timestamp: new Date(Date.now() - 18000000).toISOString() },
];

export default function CommentsPage() {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [responses,    setResponses]    = useState<InteractionResponse[]>([]);
  const [summary,      setSummary]      = useState<CommunitySummary | null>(null);
  const [loading,      setLoading]      = useState(false);

  async function processInteractions() {
    const toProcess = interactions.length ? interactions : DEMO_INTERACTIONS;
    if (!interactions.length) setInteractions(DEMO_INTERACTIONS);
    setLoading(true);
    try {
      const res = await fetch('/api/agents/community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interactions: toProcess, autoPostReplies: false }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al procesar');
      const data = json.data as CommunityOutput;
      setResponses(data.responses);
      setSummary(data.summary);
      toast.success(`${data.responses.length} interacciones analizadas`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">Comunidad</h1>
          <p className="page-sub">Gestiona comentarios y mensajes con IA</p>
        </div>
        <button className="btn-primary btn-orange" onClick={processInteractions} disabled={loading}>
          {loading ? <span className="loading-spinner" /> : <Zap size={16} />}
          {loading ? 'Procesando…' : 'Procesar con IA'}
        </button>
      </div>

      {/* Summary */}
      {summary && (
        <>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 24 }}>
            <div className="stat-card"><div><p className="stat-label">Total</p><p className="stat-value">{summary.total}</p></div></div>
            <div className="stat-card"><div><p className="stat-label">Auto-respondidas</p><p className="stat-value">{summary.autoResponded}</p></div></div>
            <div className="stat-card"><div><p className="stat-label">Escaladas</p><p className="stat-value">{summary.escalated}</p></div></div>
            <div className="stat-card"><div><p className="stat-label">Sentimiento</p><p className="stat-value">{Math.round(summary.sentimentBreakdown.positive / summary.total * 100)}% +</p></div></div>
          </div>
          {summary.digest && (
            <div className="settings-section" style={{ marginBottom: 24 }}>
              <div className="settings-section-title">Resumen IA</div>
              <p style={{ fontSize: '0.9rem', lineHeight: 1.7 }}>{summary.digest}</p>
            </div>
          )}
        </>
      )}

      <CommentsInbox
        interactions={interactions}
        responses={responses}
        loading={loading}
        onProcess={processInteractions}
      />
    </div>
  );
}
