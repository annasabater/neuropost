'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { BarChart3, Zap, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { AnalystOutput } from '@/types';
import { MetricsDashboard } from '@/components/analytics/MetricsDashboard';

export default function AnalyticsPage() {
  const t = useTranslations('analytics');
  const tCal = useTranslations('calendar');
  const now   = new Date();
  const [month,   setMonth]   = useState(now.getMonth() + 1);
  const [year,    setYear]    = useState(now.getFullYear());
  const [data,    setData]    = useState<AnalystOutput | null>(null);
  const [loading, setLoading] = useState(false);

  async function runReport() {
    setLoading(true);
    try {
      const res = await fetch('/api/agents/analyst', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ month, year }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al generar informe');
      setData(json.data as AnalystOutput);
      toast.success(t('generated'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  }

  const MONTHS = [
    tCal('months.january'), tCal('months.february'), tCal('months.march'),
    tCal('months.april'), tCal('months.may'), tCal('months.june'),
    tCal('months.july'), tCal('months.august'), tCal('months.september'),
    tCal('months.october'), tCal('months.november'), tCal('months.december'),
  ];

  // Derive "what's working" from insights + recommendations
  function whatIsWorking(report: AnalystOutput) {
    const keep = report.insights.filter((i) => i.type === 'strength');
    const stop = report.insights.filter((i) => i.type === 'weakness');
    const opps = report.insights.filter((i) => i.type === 'opportunity');
    const highRecs = report.recommendations.filter((r) => r.priority === 'high');
    return { keep, stop, opps, highRecs };
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">{t('title')}</h1>
          <p className="page-sub">{t('subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select className="count-select" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select className="count-select" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[now.getFullYear() - 1, now.getFullYear()].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button className="btn-primary btn-orange" onClick={runReport} disabled={loading}>
            {loading ? <span className="loading-spinner" /> : <Zap size={16} />}
            {loading ? t('generating') : t('generate')}
          </button>
        </div>
      </div>

      {data ? (
        <>
          {/* ── What's Working ─────────────────────────────────────────── */}
          {(() => {
            const { keep, stop, opps, highRecs } = whatIsWorking(data);
            return (
              <div style={{ marginBottom: 32 }}>
                <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {t('whatWorking')}
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                  {/* Keep doing */}
                  <div style={{
                    padding:      16,
                    borderRadius: 12,
                    background:   'var(--accent-bg)',
                    border:       '1px solid var(--border)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <TrendingUp size={18} color="var(--accent)" />
                      <span style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 800, fontSize: '0.88rem', color: 'var(--accent)' }}>
                        {t('keepDoing')}
                      </span>
                    </div>
                    {keep.length === 0 ? (
                      <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{t('noInsights')}</p>
                    ) : keep.map((i, idx) => (
                      <div key={idx} style={{ marginBottom: 8 }}>
                        <p style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, fontSize: '0.83rem', color: 'var(--accent-dark)' }}>{i.title}</p>
                        <p style={{ fontSize: '0.78rem', color: 'var(--accent-dark)', lineHeight: 1.4 }}>{i.description}</p>
                        {i.supportingMetric && <p style={{ fontSize: '0.73rem', color: 'var(--accent)', fontWeight: 600, marginTop: 2 }}>{i.supportingMetric}</p>}
                      </div>
                    ))}
                  </div>

                  {/* Stop doing */}
                  <div style={{
                    padding:      16,
                    borderRadius: 12,
                    background:   'var(--error-dim)',
                    border:       '1px solid var(--border)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <TrendingDown size={18} color="var(--error)" />
                      <span style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 800, fontSize: '0.88rem', color: 'var(--error)' }}>
                        {t('stopDoing')}
                      </span>
                    </div>
                    {stop.length === 0 ? (
                      <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{t('noImprove')}</p>
                    ) : stop.map((i, idx) => (
                      <div key={idx} style={{ marginBottom: 8 }}>
                        <p style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, fontSize: '0.83rem', color: 'var(--error)' }}>{i.title}</p>
                        <p style={{ fontSize: '0.78rem', color: 'var(--error)', lineHeight: 1.4 }}>{i.description}</p>
                      </div>
                    ))}
                  </div>

                  {/* Opportunities */}
                  <div style={{
                    padding:      16,
                    borderRadius: 12,
                    background:   'var(--warning-dim)',
                    border:       '1px solid var(--border)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <Minus size={18} color="var(--warning)" />
                      <span style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 800, fontSize: '0.88rem', color: 'var(--warning)' }}>
                        {t('opportunities')}
                      </span>
                    </div>
                    {opps.length === 0 && highRecs.length === 0 ? (
                      <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{t('noOpps')}</p>
                    ) : (
                      <>
                        {opps.map((i, idx) => (
                          <div key={idx} style={{ marginBottom: 8 }}>
                            <p style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, fontSize: '0.83rem', color: 'var(--warning)' }}>{i.title}</p>
                            <p style={{ fontSize: '0.78rem', color: 'var(--warning)', lineHeight: 1.4 }}>{i.description}</p>
                          </div>
                        ))}
                        {highRecs.slice(0, 2).map((r, idx) => (
                          <div key={`rec-${idx}`} style={{ marginBottom: 8 }}>
                            <p style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, fontSize: '0.83rem', color: 'var(--warning)' }}>{r.action}</p>
                            <p style={{ fontSize: '0.78rem', color: 'var(--warning)', lineHeight: 1.4 }}>{r.estimatedImpact}</p>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          <MetricsDashboard data={data} />
        </>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon"><BarChart3 size={36} color="var(--orange)" /></div>
          <p className="empty-state-title">{t('noDataTitle')}</p>
          <p className="empty-state-sub">{t('noDataSub')}</p>
          <button className="btn-primary btn-orange" onClick={runReport} disabled={loading}>
            {loading ? t('generating') : t('generate')}
          </button>
        </div>
      )}
    </div>
  );
}
