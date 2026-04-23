'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, ArrowRight, X } from 'lucide-react';

interface BrandTrend {
  id:                  string;
  adapted_caption:     string;
  visual_instructions: string;
  urgency:             string;
  trends?: { title: string; format: string; viral_score: number };
}

export function TrendsBanner() {
  const router = useRouter();
  const [trend,     setTrend]     = useState<BrandTrend | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [using,     setUsing]     = useState(false);

  useEffect(() => {
    fetch('/api/agents/trends/adapt/list?latest=1')
      .then(r => r.ok ? r.json() : null)
      .then((data: { brandTrend?: BrandTrend } | null) => {
        if (data?.brandTrend) setTrend(data.brandTrend);
      })
      .catch(() => null);
  }, []);

  if (!trend || dismissed) return null;

  async function handleUse() {
    if (!trend) return;
    setUsing(true);
    const res  = await fetch('/api/agents/trends/use', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ brandTrendId: trend.id }),
    });
    const data = await res.json() as { post?: { id: string } };
    if (data.post) router.push(`/posts/${data.post.id}`);
    setUsing(false);
  }

  return (
    <div style={{
      background:    'linear-gradient(135deg, rgba(255,107,53,0.12) 0%, rgba(255,107,53,0.06) 100%)',
      border:        '1px solid rgba(255,107,53,0.3)',
      borderRadius:  12,
      padding:       '14px 18px',
      display:       'flex',
      alignItems:    'center',
      gap:           14,
      marginBottom:  20,
      position:      'relative',
    }}>
      <div style={{ background: 'rgba(255,107,53,0.15)', borderRadius: 8, padding: 8, flexShrink: 0 }}>
        <TrendingUp size={18} style={{ color: '#ff6b35' }} />
      </div>
      <div className="trends-banner-text" style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#ff6b35', margin: '0 0 2px' }}>
          🔥 Esta semana está funcionando: {trend.trends?.title ?? 'Nueva tendencia viral'}
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {trend.trends?.format ? `Formato: ${trend.trends.format} · ` : ''}{trend.visual_instructions ?? ''}
        </p>
      </div>
      <button
        onClick={handleUse}
        disabled={using}
        style={{
          display:      'flex',
          alignItems:   'center',
          gap:          5,
          background:   '#ff6b35',
          color:        '#fff',
          border:       'none',
          borderRadius: 7,
          padding:      '7px 13px',
          fontSize:     12,
          fontWeight:   600,
          cursor:       using ? 'not-allowed' : 'pointer',
          opacity:      using ? 0.6 : 1,
          flexShrink:   0,
        }}
      >
        {using ? 'Creando...' : 'Crear post'} <ArrowRight size={12} />
      </button>
      <button
        onClick={() => setDismissed(true)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, flexShrink: 0 }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
