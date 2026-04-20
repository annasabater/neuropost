'use client';

import { PLAN_META, PLAN_LIMITS, type SubscriptionPlan } from '@/types';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

const VISIBLE_PLANS: { key: SubscriptionPlan; featured?: boolean }[] = [
  { key: 'starter' },
  { key: 'pro', featured: true },
  { key: 'total' },
];

function featureList(plan: SubscriptionPlan): string[] {
  const l = PLAN_LIMITS[plan];
  const m = PLAN_META[plan];
  const features: string[] = [];
  features.push(`${l.brands} negocio${l.brands > 1 ? 's' : ''}`);
  features.push(`${l.postsPerWeek} posts / semana`);
  if (l.videosPerWeek > 0) features.push(`${l.videosPerWeek} vídeos / semana`);
  features.push(l.allowedPlatforms.includes('tiktok') ? 'Instagram + Facebook + TikTok' : 'Instagram + Facebook');
  if (l.autoPublish) features.push('Auto-publicación');
  if (l.competitorAgent) features.push('Agente competencia + tendencias');
  features.push(m.tagline.split('·').pop()?.trim() ?? '');
  return features.filter(Boolean);
}

export default function PlansGrid({ currentPlan, disabled }: { currentPlan: SubscriptionPlan; disabled?: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
      {VISIBLE_PLANS.map(({ key, featured }) => {
        const meta = PLAN_META[key];
        const isCurrent = key === currentPlan;
        const features = featureList(key);

        return (
          <div key={key} style={{
            background: 'var(--surface)', border: `1px solid ${featured ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 14, padding: '28px 24px 24px', display: 'flex', flexDirection: 'column',
            position: 'relative',
            boxShadow: featured ? '0 0 0 3px rgba(15,118,110,0.12), 0 4px 16px rgba(16,24,40,.06)' : '0 1px 2px rgba(16,24,40,.04)',
          }}>
            {featured && (
              <div style={{
                position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)',
                background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 600,
                padding: '4px 10px', borderRadius: 999, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: f,
              }}>Más popular</div>
            )}
            {isCurrent && (
              <div style={{
                position: 'absolute', top: 18, right: 18, fontSize: 11, fontWeight: 600,
                color: 'var(--accent)', background: 'var(--accent-light)', padding: '3px 8px',
                borderRadius: 999, letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: f,
              }}>Tu plan</div>
            )}

            <div style={{ fontFamily: fc, fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', marginBottom: 4, color: 'var(--text-primary)' }}>
              {meta.label}
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', fontFamily: f, marginBottom: 20, minHeight: 36 }}>
              {meta.tagline}
            </div>

            <div style={{ marginBottom: 22, display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontFamily: fc, fontSize: 40, fontWeight: 500, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
                {meta.price} €
              </span>
              <span style={{ color: 'var(--muted)', fontSize: 13, fontFamily: f }}>/mes</span>
            </div>

            <ul style={{ listStyle: 'none', marginBottom: 24, flex: 1, padding: 0 }}>
              {features.map((feat, i) => (
                <li key={i} style={{
                  fontSize: 13.5, padding: '7px 0 7px 22px', position: 'relative',
                  color: 'var(--text-primary)', fontFamily: f,
                }}>
                  <span style={{
                    position: 'absolute', left: 0, top: 13, width: 12, height: 6,
                    borderLeft: '1.5px solid var(--accent)', borderBottom: '1.5px solid var(--accent)',
                    transform: 'rotate(-45deg)', display: 'inline-block',
                  }} />
                  {feat}
                </li>
              ))}
            </ul>

            {isCurrent ? (
              <button disabled style={{
                padding: '10px 16px', borderRadius: 8, border: 'none',
                background: 'var(--accent)', color: '#fff', fontFamily: f,
                fontWeight: 500, fontSize: 14, opacity: 0.6, cursor: 'default',
              }}>Plan actual</button>
            ) : (
              <button disabled={disabled} onClick={() => {
                if (!disabled) window.location.href = `/api/stripe/checkout?plan=${key}`;
              }} style={{
                padding: '10px 16px', borderRadius: 8,
                border: key === 'starter' ? '1px solid var(--border)' : 'none',
                background: key === 'starter' ? 'transparent' : 'var(--text-primary)',
                color: key === 'starter' ? 'var(--text-primary)' : '#fff',
                fontFamily: f, fontWeight: 500, fontSize: 14,
                cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
              }}>
                {meta.price < PLAN_META[currentPlan].price ? `Bajar a ${meta.label}` : `Subir a ${meta.label}`}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
