'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Plus, Loader2 } from 'lucide-react';
import { PlanGate } from '@/components/PlanGate';

interface ContentIdea {
  title:         string;
  format:        string;
  caption:       string;
  hashtags:      string[];
  inspiration:   string;
  originalTwist: string;
}

interface Analysis {
  id:                  string;
  competitor_username: string;
  followers_count:     number;
  avg_engagement:      number;
  top_formats:         string[];
  top_topics:          string[];
  posting_frequency:   string;
  strengths:           string[];
  weaknesses:          string[];
  opportunity_gaps:    string;
  content_ideas:       ContentIdea[];
  analyzed_at:         string;
}

export default function CompetenciaPage() {
  return (
    <PlanGate
      feature="competitorAgent"
      title="Análisis de competencia"
      description="Descubre qué está funcionando en tu sector. Analizamos cuentas de competidores y sacamos ideas de contenido adaptadas a tu marca."
    >
      <CompetenciaContent />
    </PlanGate>
  );
}

function CompetenciaContent() {
  const router  = useRouter();
  const [analyses,   setAnalyses]   = useState<Analysis[]>([]);
  const [selected,   setSelected]   = useState<Analysis | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [analyzing,  setAnalyzing]  = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [creatingPost, setCreatingPost] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/agents/competitor/ideas')
      .then(r => r.json())
      .then((data: { analyses: Analysis[] }) => {
        const list = data.analyses ?? [];
        setAnalyses(list);
        if (list.length) setSelected(list[0]);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleAnalyze() {
    if (!newUsername.trim()) return;
    setAnalyzing(true);
    const res  = await fetch('/api/agents/competitor/analyze', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ competitorUsername: newUsername.trim().replace('@', '') }),
    });
    const data = await res.json() as { analysis: Analysis };
    if (data.analysis) {
      setAnalyses(a => [data.analysis, ...a.filter(x => x.competitor_username !== data.analysis.competitor_username)]);
      setSelected(data.analysis);
      setNewUsername('');
    }
    setAnalyzing(false);
  }

  async function handleCreatePost(idea: ContentIdea) {
    setCreatingPost(idea.title);
    const res  = await fetch('/api/posts', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ caption: idea.caption, hashtags: idea.hashtags, status: 'draft', goal: 'engagement', metadata: { source: 'competitor', inspiration: idea.inspiration } }),
    });
    const data = await res.json() as { post?: { id: string } };
    if (data.post) router.push(`/posts/${data.post.id}`);
    setCreatingPost(null);
  }

  if (loading) return <div className="page-content"><p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Cargando análisis...</p></div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">Análisis de competencia</h1>
          <p className="page-sub">Qué está funcionando en tu sector · actualizado semanalmente</p>
        </div>
      </div>

      {/* Add competitor */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <input
          value={newUsername}
          onChange={e => setNewUsername(e.target.value)}
          placeholder="@username del competidor"
          style={{ flex: 1, maxWidth: 260, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, padding: '8px 12px', outline: 'none' }}
          onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
        />
        <button
          onClick={handleAnalyze}
          disabled={analyzing || !newUsername.trim()}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 5 }}
        >
          {analyzing ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Analizando...</> : <><Plus size={13} /> Analizar</>}
        </button>
      </div>

      {analyses.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)' }}>
          <Users size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p style={{ fontSize: 14 }}>Añade el @username de tu primer competidor.</p>
          <p style={{ fontSize: 12 }}>Solo se analiza información pública de Instagram.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20, alignItems: 'start' }}>
          {/* Competitor tabs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {analyses.map(a => (
              <button
                key={a.id}
                onClick={() => setSelected(a)}
                style={{
                  padding:    '9px 12px',
                  borderRadius: 8,
                  background: selected?.id === a.id ? 'rgba(255,107,53,0.12)' : 'transparent',
                  border:     `1px solid ${selected?.id === a.id ? 'rgba(255,107,53,0.3)' : 'var(--border)'}`,
                  color:      selected?.id === a.id ? '#ff6b35' : 'var(--text-secondary)',
                  fontSize:   13,
                  fontWeight: selected?.id === a.id ? 700 : 400,
                  cursor:     'pointer',
                  textAlign:  'left',
                }}
              >
                @{a.competitor_username}
              </button>
            ))}
          </div>

          {/* Analysis detail */}
          {selected && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Summary card */}
              <div className="card">
                <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px' }}>@{selected.competitor_username}</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                  {[
                    ['Seguidores',    selected.followers_count?.toLocaleString('es-ES') ?? '—'],
                    ['Engagement',    selected.avg_engagement ? `${selected.avg_engagement.toFixed(1)}%` : '—'],
                    ['Frecuencia',    selected.posting_frequency ?? '—'],
                  ].map(([l, v]) => (
                    <div key={String(l)} style={{ background: 'var(--card-bg)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{v}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{l}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', margin: '0 0 6px' }}>FORTALEZAS</p>
                    {(selected.strengths ?? []).map((s, i) => <p key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 3px' }}>+ {s}</p>)}
                  </div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#f87171', margin: '0 0 6px' }}>DEBILIDADES</p>
                    {(selected.weaknesses ?? []).map((w, i) => <p key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 3px' }}>− {w}</p>)}
                  </div>
                </div>

                {selected.opportunity_gaps && (
                  <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(255,107,53,0.06)', borderRadius: 8, border: '1px solid rgba(255,107,53,0.2)' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#ff6b35', margin: '0 0 4px' }}>💡 OPORTUNIDAD</p>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{selected.opportunity_gaps}</p>
                  </div>
                )}
              </div>

              {/* Content ideas */}
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px' }}>Ideas de contenido inspiradas</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(selected.content_ideas ?? []).map((idea, i) => (
                    <div key={i} className="card" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{idea.title}</span>
                          <span style={{ fontSize: 10, color: 'var(--text-secondary)', background: 'var(--card-bg)', padding: '1px 6px', borderRadius: 4, border: '1px solid var(--border)' }}>{idea.format}</span>
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 6px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {idea.caption}
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>
                          💡 {idea.originalTwist}
                        </p>
                      </div>
                      <button
                        onClick={() => handleCreatePost(idea)}
                        disabled={creatingPost === idea.title}
                        className="btn-primary"
                        style={{ fontSize: 12, padding: '7px 12px', whiteSpace: 'nowrap' }}
                      >
                        {creatingPost === idea.title ? '...' : 'Crear post →'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
