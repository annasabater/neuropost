'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { Zap, MessageSquare, AlertTriangle, ThumbsUp, ArrowRight, Send, Link2 } from 'lucide-react';
import type { Interaction, InteractionResponse, CommunitySummary, CommunityOutput } from '@/types';
import { CommentsInbox } from '@/components/comments/CommentsInbox';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

const DEMO_INTERACTIONS: Interaction[] = [
  { id: 'i1', type: 'comment', platform: 'instagram', authorId: 'u1', authorName: 'María García', text: '¡Me encanta vuestro nuevo producto! ¿Cuándo lo tendréis disponible online?', timestamp: new Date(Date.now() - 3600000).toISOString() },
  { id: 'i2', type: 'comment', platform: 'facebook',  authorId: 'u2', authorName: 'Carlos López', text: 'Llevo esperando el pedido 2 semanas y nadie me responde. Muy mal servicio.', timestamp: new Date(Date.now() - 7200000).toISOString() },
  { id: 'i3', type: 'dm',      platform: 'instagram', authorId: 'u3', authorName: 'Ana Martín',   text: 'Hola! ¿Hacéis envíos a Canarias? Muchas gracias', timestamp: new Date(Date.now() - 10800000).toISOString() },
  { id: 'i4', type: 'comment', platform: 'instagram', authorId: 'u4', authorName: 'Pedro Ruiz',   text: 'El mejor sitio de la ciudad sin duda', timestamp: new Date(Date.now() - 14400000).toISOString() },
  { id: 'i5', type: 'comment', platform: 'facebook',  authorId: 'u5', authorName: 'Lucía Sanz',   text: 'Pregunta: ¿tenéis opción vegetariana en el menú del mediodía?', timestamp: new Date(Date.now() - 18000000).toISOString() },
];

const SENTIMENT_COLOR: Record<string, string> = { positive: '#0F766E', negative: '#c62828', neutral: '#6b7280' };

export default function CommentsPage() {
  const t = useTranslations('comments');
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [responses, setResponses] = useState<InteractionResponse[]>([]);
  const [summary, setSummary] = useState<CommunitySummary | null>(null);
  const [loading, setLoading] = useState(false);

  async function processInteractions() {
    const toProcess = interactions.length ? interactions : DEMO_INTERACTIONS;
    if (!interactions.length) setInteractions(DEMO_INTERACTIONS);
    setLoading(true);
    try {
      const res = await fetch('/api/agents/community', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interactions: toProcess, autoPostReplies: false }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al procesar');
      const data = json.data as CommunityOutput;
      setResponses(data.responses);
      setSummary(data.summary);
      toast.success(t('analyzed', { count: data.responses.length }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-content" style={{ maxWidth: 1000 }}>
      {/* ── Header ── */}
      <div style={{ padding: '48px 0 32px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#9ca3af', marginBottom: 8 }}>
            IA Community Manager
          </div>
          <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: '#111827', lineHeight: 0.95, marginBottom: 8 }}>
            {t('communityTitle')}
          </h1>
          <p style={{ color: '#6b7280', fontSize: 15, fontFamily: f }}>{t('communitySubtitle')}</p>
        </div>
        <button onClick={processInteractions} disabled={loading} style={{
          background: '#111827', color: '#ffffff', border: 'none',
          padding: '10px 24px', fontFamily: fc, fontSize: 12, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.08em', cursor: loading ? 'wait' : 'pointer',
          display: 'flex', alignItems: 'center', gap: 6, borderRadius: 6, opacity: loading ? 0.6 : 1, flexShrink: 0,
        }}>
          {loading ? <span className="loading-spinner" /> : <Zap size={14} />}
          {loading ? t('processing') : t('processAI')}
        </button>
      </div>

      {/* ── Summary stats ── */}
      {summary && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: '#d4d4d8', border: '1px solid #d4d4d8', marginBottom: 24 }}>
            {[
              { icon: MessageSquare, label: t('stats.total'), value: String(summary.total) },
              { icon: Send, label: t('stats.autoReplied'), value: String(summary.autoResponded) },
              { icon: AlertTriangle, label: t('stats.escalated'), value: String(summary.escalated) },
              { icon: ThumbsUp, label: t('stats.sentiment'), value: `${Math.round(summary.sentimentBreakdown.positive / summary.total * 100)}%` },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} style={{ background: '#ffffff', padding: '20px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Icon size={14} style={{ color: '#9ca3af' }} />
                  <span style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9ca3af' }}>{label}</span>
                </div>
                <p style={{ fontFamily: fc, fontWeight: 900, fontSize: '2.2rem', letterSpacing: '-0.02em', color: '#111827', lineHeight: 1 }}>{value}</p>
              </div>
            ))}
          </div>

          {/* AI Summary */}
          {summary.digest && (
            <div style={{ background: '#ffffff', border: '1px solid #d4d4d8', padding: '20px 24px', marginBottom: 32 }}>
              <h2 style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#9ca3af', marginBottom: 12 }}>
                {t('aiSummary')}
              </h2>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: '#374151', fontFamily: f }}>{summary.digest}</p>
            </div>
          )}
        </>
      )}

      {/* ── Empty state with AI preview ── */}
      {!summary && !loading && interactions.length === 0 && (
        <div style={{ marginTop: 8 }}>
          {/* Preview of how AI works */}
          <div style={{ border: '1px solid #d4d4d8', marginBottom: 32 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#9ca3af', margin: 0 }}>
                Así responde la IA
              </h2>
              <span style={{ fontFamily: f, fontSize: 10, color: '#d1d5db', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Demo</span>
            </div>
            {[
              { name: 'María García', msg: '¡Me encanta vuestro producto! ¿Cuándo online?', reply: 'Gracias María! Estará disponible online la semana que viene. Te avisamos.', sentiment: 'positive' },
              { name: 'Carlos López', msg: 'Llevo 2 semanas esperando. Muy mal servicio.', reply: null, sentiment: 'negative', escalated: true },
              { name: 'Ana Martín', msg: '¿Hacéis envíos a Canarias?', reply: 'Sí Ana, enviamos a toda España incluyendo Canarias. Gastos de envío gratuitos a partir de 30€.', sentiment: 'neutral' },
            ].map((item, i) => (
              <div key={i} style={{ padding: '16px 20px', borderBottom: i < 2 ? '1px solid #f3f4f6' : 'none', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                {/* Avatar */}
                <div style={{ width: 32, height: 32, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: f, fontSize: 12, fontWeight: 700, color: '#6b7280', flexShrink: 0 }}>
                  {item.name.charAt(0)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontFamily: f, fontSize: 13, fontWeight: 600, color: '#111827' }}>{item.name}</span>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: SENTIMENT_COLOR[item.sentiment] }} />
                  </div>
                  <p style={{ fontFamily: f, fontSize: 13, color: '#374151', lineHeight: 1.5, marginBottom: 8 }}>{item.msg}</p>
                  {item.reply && (
                    <div style={{ background: '#f0fdf4', padding: '10px 14px', borderLeft: '2px solid #0F766E' }}>
                      <p style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0F766E', marginBottom: 4 }}>Respuesta IA</p>
                      <p style={{ fontFamily: f, fontSize: 12, color: '#374151', lineHeight: 1.5 }}>{item.reply}</p>
                    </div>
                  )}
                  {item.escalated && (
                    <div style={{ background: '#fef2f2', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <AlertTriangle size={12} color="#c62828" />
                      <span style={{ fontFamily: f, fontSize: 11, fontWeight: 600, color: '#c62828' }}>Escalado — requiere atención manual</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div style={{ textAlign: 'center', padding: '24px 20px 48px' }}>
            <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 28, textTransform: 'uppercase', color: '#111827', marginBottom: 8, letterSpacing: '0.01em' }}>
              Prueba la IA con datos demo
            </p>
            <p style={{ fontSize: 14, color: '#6b7280', fontFamily: f, marginBottom: 32, maxWidth: 420, margin: '0 auto 32px' }}>
              Procesa 5 comentarios de ejemplo para ver cómo responde automáticamente la IA
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button onClick={processInteractions} disabled={loading} style={{
                background: '#111827', color: '#ffffff', border: 'none',
                padding: '14px 32px', fontFamily: fc, fontSize: 13, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 6,
              }}>
                <Zap size={14} /> Procesar demo <ArrowRight size={14} />
              </button>
              <a href="/settings/connections" style={{
                padding: '14px 24px', border: '1px solid #d4d4d8', background: '#ffffff',
                fontFamily: f, fontSize: 13, fontWeight: 600, color: '#6b7280',
                textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 6,
              }}>
                <Link2 size={14} /> Conectar Instagram
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Inbox ── */}
      <CommentsInbox
        interactions={interactions}
        responses={responses}
        loading={loading}
        onProcess={processInteractions}
      />
    </div>
  );
}
