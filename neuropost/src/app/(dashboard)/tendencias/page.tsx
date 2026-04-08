'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { TrendingUp, Check, X } from 'lucide-react';

interface BrandTrend {
  id:                  string;
  adapted_caption:     string;
  adapted_hashtags:    string[];
  visual_instructions: string;
  urgency:             'alta' | 'media' | 'baja';
  status:              'suggested' | 'used' | 'ignored';
  created_at:          string;
  trends?: {
    title:       string;
    format:      string;
    description: string;
    viral_score: number;
    expires_in:  string;
    hashtags:    string[];
    week_of:     string;
  };
}

const URGENCY_COLOR: Record<string, string> = {
  alta:  '#f87171',
  media: '#ff6b35',
  baja:  '#4ade80',
};

export default function TendenciasPage() {
  const t = useTranslations('trends');
  const router   = useRouter();
  const [trends, setTrends]   = useState<BrandTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [using,   setUsing]   = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/agents/trends/adapt/list')
      .then(r => r.json())
      .then((data: { brandTrends?: BrandTrend[] }) => setTrends(data.brandTrends ?? []))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  async function handleUse(brandTrendId: string) {
    setUsing(brandTrendId);
    const res  = await fetch('/api/agents/trends/use', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ brandTrendId }),
    });
    const data = await res.json() as { post?: { id: string } };
    if (data.post) router.push(`/posts/${data.post.id}`);
    setUsing(null);
  }

  async function handleIgnore(brandTrendId: string) {
    await fetch(`/api/agents/trends/use`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ brandTrendId, status: 'ignored' }),
    });
    setTrends(t2 => t2.map(x => x.id === brandTrendId ? { ...x, status: 'ignored' } : x));
  }

  const active  = trends.filter(tr => tr.status === 'suggested');
  const used    = trends.filter(tr => tr.status === 'used');
  const ignored = trends.filter(tr => tr.status === 'ignored');

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">{t('weekTitle')}</h1>
          <p className="page-sub">{t('weekSubtitle')} · {t('newCount', { count: active.length })}</p>
        </div>
      </div>

      {loading && <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{t('loading')}</p>}

      {!loading && active.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)' }}>
          <TrendingUp size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p style={{ fontSize: 14 }}>{t('noNew')}</p>
          <p style={{ fontSize: 12 }}>{t('autoDetect')}</p>
        </div>
      )}

      {active.length > 0 && (
        <>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 14px' }}>
            {t('thisWeek', { count: active.length })}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, marginBottom: 32 }}>
            {active.map(tr => (
              <div key={tr.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
                      {tr.trends?.title ?? t('title')}
                    </h3>
                    {tr.trends?.format && (
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'var(--card-bg)', padding: '2px 7px', borderRadius: 4, border: '1px solid var(--border)' }}>
                        {tr.trends.format}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: URGENCY_COLOR[tr.urgency], background: `${URGENCY_COLOR[tr.urgency]}18`, padding: '2px 8px', borderRadius: 10, flexShrink: 0 }}>
                    {t(`urgency.${tr.urgency}`)}
                  </span>
                </div>

                {/* Viral score */}
                {tr.trends?.viral_score != null && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      <span>{t('scoreViral')}</span><span>{tr.trends.viral_score}%</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${tr.trends.viral_score}%`, background: 'var(--accent)', borderRadius: 2 }} />
                    </div>
                  </div>
                )}

                {/* Caption preview */}
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {tr.adapted_caption}
                </p>

                {/* Visual instructions */}
                {tr.visual_instructions && (
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'var(--card-bg)', padding: '6px 10px', borderRadius: 6, margin: 0, lineHeight: 1.4 }}>
                    📸 {tr.visual_instructions}
                  </p>
                )}

                {/* Expires */}
                {tr.trends?.expires_in && (
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>
                    ⏳ {t('expiresIn')} {tr.trends.expires_in}
                  </p>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                  <button
                    onClick={() => handleUse(tr.id)}
                    disabled={using === tr.id}
                    className="btn-primary"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                  >
                    <Check size={13} /> {using === tr.id ? t('using') : t('useTrendShort')}
                  </button>
                  <button
                    onClick={() => handleIgnore(tr.id)}
                    className="btn-ghost"
                    style={{ padding: '8px 10px' }}
                    title={t('ignore')}
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Used / Ignored history */}
      {(used.length > 0 || ignored.length > 0) && (
        <>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 14px' }}>
            {t('history')}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...used, ...ignored].map(tr => (
              <div key={tr.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', opacity: 0.6 }}>
                <span style={{ fontSize: 11, background: tr.status === 'used' ? 'rgba(74,222,128,0.15)' : 'var(--card-bg)', color: tr.status === 'used' ? '#4ade80' : 'var(--text-secondary)', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                  {tr.status === 'used' ? t('used') : t('ignored')}
                </span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{tr.trends?.title ?? t('title')}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
