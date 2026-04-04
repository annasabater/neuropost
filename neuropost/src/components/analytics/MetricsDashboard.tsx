'use client';

import type { AnalystOutput, InsightType } from '@/types';

interface Props {
  data: AnalystOutput;
}

const INSIGHT_ICONS: Record<InsightType, string> = {
  strength:    '💪',
  weakness:    '⚠️',
  opportunity: '🚀',
  threat:      '🔴',
};

function scoreClass(v: number) {
  if (v >= 7) return 'high';
  if (v >= 4) return 'mid';
  return 'low';
}

const SCORE_LABELS: Record<string, string> = {
  overall:   'General',
  content:   'Contenido',
  community: 'Comunidad',
  growth:    'Crecimiento',
  execution: 'Ejecución',
};

export function MetricsDashboard({ data }: Props) {
  return (
    <div>
      {/* Scores */}
      <div className="scores-grid">
        {(Object.entries(data.scores) as [string, number][]).map(([key, value]) => (
          <div key={key} className="score-card">
            <p className="score-label">{SCORE_LABELS[key] ?? key}</p>
            <p className={`score-value ${scoreClass(value)}`}>{value.toFixed(1)}</p>
          </div>
        ))}
      </div>

      {/* Platform breakdowns */}
      {data.platformBreakdowns.length > 0 && (
        <>
          <h2 className="section-title">Por plataforma</h2>
          <div className="stats-grid" style={{ gridTemplateColumns: `repeat(${data.platformBreakdowns.length}, 1fr)` }}>
            {data.platformBreakdowns.map((pb) => (
              <div key={pb.platform} className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
                <p className="stat-label" style={{ textTransform: 'capitalize', fontWeight: 800 }}>{pb.platform}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: '0.82rem' }}>Alcance: <strong>{pb.totalReach.toLocaleString('es-ES')}</strong></span>
                  <span style={{ fontSize: '0.82rem' }}>Engagement: <strong>{pb.avgEngagementRate.toFixed(1)}%</strong></span>
                  <span style={{ fontSize: '0.82rem' }}>Seguidores +: <strong>{pb.followersGained}</strong></span>
                  <span style={{ fontSize: '0.82rem' }}>Posts: <strong>{pb.postCount}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Top posts */}
      {data.topPosts.length > 0 && (
        <>
          <h2 className="section-title">Mejores posts</h2>
          <div className="posts-list">
            {data.topPosts.map((p) => (
              <div key={p.postId} className="post-list-item">
                <div className="post-list-info">
                  <span className="interaction-platform">{p.platform}</span>
                  <span className="post-list-caption">{p.performanceFactor}</span>
                </div>
                <span className="post-list-date">ER {p.engagementRate.toFixed(1)}% · {p.reach.toLocaleString('es-ES')} alcance</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Insights */}
      {data.insights.length > 0 && (
        <>
          <h2 className="section-title">Insights</h2>
          <div className="insights-list">
            {data.insights.map((ins, i) => (
              <div key={i} className="insight-card">
                <div className={`insight-icon insight-${ins.type}`}>{INSIGHT_ICONS[ins.type]}</div>
                <div>
                  <p className="insight-title">{ins.title}</p>
                  <p className="insight-desc">{ins.description}</p>
                  {ins.supportingMetric && (
                    <p style={{ marginTop: 4, fontSize: '0.78rem', color: 'var(--orange)', fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700 }}>
                      {ins.supportingMetric}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <>
          <h2 className="section-title">Recomendaciones</h2>
          <div className="insights-list">
            {data.recommendations.map((rec, i) => (
              <div key={i} className="rec-card">
                <span className={`rec-priority rec-${rec.priority}`}>{rec.priority}</span>
                <div>
                  <p className="rec-action">{rec.action}</p>
                  <p className="rec-rationale">{rec.rationale}</p>
                  <p style={{ marginTop: 4, fontSize: '0.78rem', color: 'var(--green)', fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700 }}>
                    Impacto estimado: {rec.estimatedImpact}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Report */}
      {data.report && (
        <>
          <h2 className="section-title">Informe completo</h2>
          <div className="settings-section">
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.88rem', lineHeight: 1.75, color: 'var(--ink)' }}>
              {data.report}
            </pre>
          </div>
        </>
      )}
    </div>
  );
}
