'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { Zap, TrendingUp, TrendingDown, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import type { AnalystOutput } from '@/types';
import { MetricsDashboard } from '@/components/analytics/MetricsDashboard';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

export default function AnalyticsPage() {
  const t = useTranslations('analytics');
  const tCal = useTranslations('calendar');
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<AnalystOutput | null>(null);
  const [loading, setLoading] = useState(false);

  async function runReport() {
    setLoading(true);
    try {
      const res = await fetch('/api/agents/analyst', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year }),
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

  function whatIsWorking(report: AnalystOutput) {
    const keep = report.insights.filter((i) => i.type === 'strength');
    const stop = report.insights.filter((i) => i.type === 'weakness');
    const opps = report.insights.filter((i) => i.type === 'opportunity');
    const highRecs = report.recommendations.filter((r) => r.priority === 'high');
    return { keep, stop, opps, highRecs };
  }

  const selectStyle: React.CSSProperties = {
    padding: '8px 32px 8px 12px', border: '1px solid #d4d4d8', background: '#ffffff',
    fontFamily: f, fontSize: 13, color: '#111827', cursor: 'pointer', outline: 'none',
    borderRadius: 6, appearance: 'none' as React.CSSProperties['appearance'],
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%236b7280' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
  };

  return (
    <div className="page-content dashboard-feature-page" style={{ maxWidth: 1000 }}>
      {/* ── Header ── */}
      <div className="dashboard-feature-header" style={{ padding: '48px 0 32px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#9ca3af', marginBottom: 8 }}>
            Informe mensual
          </div>
          <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: '#111827', lineHeight: 0.95, marginBottom: 8 }}>
            {t('title')}
          </h1>
          <p style={{ color: '#6b7280', fontSize: 15, fontFamily: f }}>{t('subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <select style={selectStyle} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select style={selectStyle} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[now.getFullYear() - 1, now.getFullYear()].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={runReport} disabled={loading} style={{
            background: '#111827', color: '#ffffff', border: 'none',
            padding: '8px 20px', fontFamily: fc, fontSize: 12, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.08em', cursor: loading ? 'wait' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, borderRadius: 6, opacity: loading ? 0.6 : 1,
          }}>
            {loading ? <span className="loading-spinner" /> : <Zap size={14} />}
            {loading ? t('generating') : t('generate')}
          </button>
        </div>
      </div>

      <div className="dashboard-feature-body">

      {data ? (
        <>
          {/* ── Insights section ── */}
          {(() => {
            const { keep, stop, opps, highRecs } = whatIsWorking(data);
            return (
              <>
                {/* 3-column insights grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: '#d4d4d8', border: '1px solid #d4d4d8', marginBottom: 32 }}>
                  {/* Keep doing */}
                  <div style={{ background: '#ffffff', padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                      <TrendingUp size={16} color="#0F766E" />
                      <span style={{ fontFamily: fc, fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#0F766E' }}>
                        {t('keepDoing')}
                      </span>
                    </div>
                    {keep.length === 0 ? (
                      <p style={{ fontSize: 13, color: '#9ca3af', fontFamily: f }}>{t('noInsights')}</p>
                    ) : keep.map((i, idx) => (
                      <div key={idx} style={{ marginBottom: 12 }}>
                        <p style={{ fontFamily: f, fontWeight: 600, fontSize: 13, color: '#111827', marginBottom: 2 }}>{i.title}</p>
                        <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5, fontFamily: f }}>{i.description}</p>
                        {i.supportingMetric && <p style={{ fontSize: 11, color: '#0F766E', fontWeight: 600, marginTop: 4, fontFamily: f }}>{i.supportingMetric}</p>}
                      </div>
                    ))}
                  </div>

                  {/* Stop doing */}
                  <div style={{ background: '#ffffff', padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                      <TrendingDown size={16} color="#c62828" />
                      <span style={{ fontFamily: fc, fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#c62828' }}>
                        {t('stopDoing')}
                      </span>
                    </div>
                    {stop.length === 0 ? (
                      <p style={{ fontSize: 13, color: '#9ca3af', fontFamily: f }}>{t('noImprove')}</p>
                    ) : stop.map((i, idx) => (
                      <div key={idx} style={{ marginBottom: 12 }}>
                        <p style={{ fontFamily: f, fontWeight: 600, fontSize: 13, color: '#111827', marginBottom: 2 }}>{i.title}</p>
                        <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5, fontFamily: f }}>{i.description}</p>
                      </div>
                    ))}
                  </div>

                  {/* Opportunities */}
                  <div style={{ background: '#ffffff', padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                      <AlertCircle size={16} color="#e65100" />
                      <span style={{ fontFamily: fc, fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#e65100' }}>
                        {t('opportunities')}
                      </span>
                    </div>
                    {opps.length === 0 && highRecs.length === 0 ? (
                      <p style={{ fontSize: 13, color: '#9ca3af', fontFamily: f }}>{t('noOpps')}</p>
                    ) : (
                      <>
                        {opps.map((i, idx) => (
                          <div key={idx} style={{ marginBottom: 12 }}>
                            <p style={{ fontFamily: f, fontWeight: 600, fontSize: 13, color: '#111827', marginBottom: 2 }}>{i.title}</p>
                            <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5, fontFamily: f }}>{i.description}</p>
                          </div>
                        ))}
                        {highRecs.slice(0, 2).map((r, idx) => (
                          <div key={`rec-${idx}`} style={{ marginBottom: 12 }}>
                            <p style={{ fontFamily: f, fontWeight: 600, fontSize: 13, color: '#111827', marginBottom: 2 }}>{r.action}</p>
                            <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5, fontFamily: f }}>{r.estimatedImpact}</p>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>

                {/* ── Recommendations — checklist ── */}
                {data.recommendations.length > 0 && (
                  <div style={{ marginBottom: 32 }}>
                    <h2 style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#9ca3af', marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid #d4d4d8' }}>
                      Qué hacer ahora
                    </h2>
                    <div style={{ border: '1px solid #d4d4d8' }}>
                      {data.recommendations.map((rec, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px',
                          borderBottom: i < data.recommendations.length - 1 ? '1px solid #e5e7eb' : 'none',
                          background: '#ffffff',
                        }}>
                          <CheckCircle2 size={16} style={{ color: rec.priority === 'high' ? '#0F766E' : '#9ca3af', marginTop: 1, flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <p style={{ fontFamily: f, fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 2 }}>{rec.action}</p>
                            {rec.estimatedImpact && <p style={{ fontSize: 12, color: '#6b7280', fontFamily: f }}>{rec.estimatedImpact}</p>}
                          </div>
                          <span style={{
                            fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                            padding: '2px 8px', color: rec.priority === 'high' ? '#0F766E' : '#6b7280',
                            background: rec.priority === 'high' ? '#f0fdf4' : '#f3f4f6',
                          }}>
                            {rec.priority}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          <MetricsDashboard data={data} />
        </>
      ) : (
        /* ── Empty state — preview skeleton ── */
        <div style={{ marginTop: 8 }}>
          {/* Fake KPIs skeleton */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: '#d4d4d8', border: '1px solid #d4d4d8', marginBottom: 32 }}>
            {['Alcance', 'Engagement', 'Seguidores', 'Posts'].map((label) => (
              <div key={label} style={{ background: '#ffffff', padding: '24px 20px' }}>
                <div style={{ width: 80, height: 32, background: '#f3f4f6', marginBottom: 8, borderRadius: 4 }} />
                <p style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#d1d5db' }}>{label}</p>
              </div>
            ))}
          </div>

          {/* Fake insights skeleton */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: '#d4d4d8', border: '1px solid #d4d4d8', marginBottom: 48 }}>
            {[{ icon: TrendingUp, label: 'Funciona', color: '#0F766E' }, { icon: TrendingDown, label: 'A mejorar', color: '#c62828' }, { icon: AlertCircle, label: 'Oportunidades', color: '#e65100' }].map(({ icon: Icon, label, color }) => (
              <div key={label} style={{ background: '#ffffff', padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <Icon size={16} color={color} />
                  <span style={{ fontFamily: fc, fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.04em', color }}>{label}</span>
                </div>
                <div style={{ width: '90%', height: 10, background: '#f3f4f6', marginBottom: 8, borderRadius: 2 }} />
                <div style={{ width: '70%', height: 10, background: '#f3f4f6', marginBottom: 8, borderRadius: 2 }} />
                <div style={{ width: '50%', height: 10, background: '#f3f4f6', borderRadius: 2 }} />
              </div>
            ))}
          </div>

          {/* CTA */}
          <div style={{ textAlign: 'center', padding: '32px 20px' }}>
            <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 28, textTransform: 'uppercase', color: '#111827', marginBottom: 8, letterSpacing: '0.01em' }}>
              {t('noDataTitle')}
            </p>
            <p style={{ fontSize: 14, color: '#6b7280', fontFamily: f, marginBottom: 32, maxWidth: 400, margin: '0 auto 32px' }}>
              {t('noDataSub')}
            </p>
            <button onClick={runReport} disabled={loading} style={{
              background: '#111827', color: '#ffffff', border: 'none',
              padding: '14px 32px', fontFamily: fc, fontSize: 14, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em', cursor: loading ? 'wait' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 6, opacity: loading ? 0.6 : 1,
            }}>
              <Zap size={16} /> {loading ? t('generating') : t('generate')} <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
