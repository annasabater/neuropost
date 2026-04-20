'use client';

/**
 * Client-side plan feature gate. Renders children only when the current
 * brand's plan unlocks the given feature flag. Otherwise shows an
 * upgrade CTA that links to /settings/plan.
 *
 * Use for feature areas like `/competencia` (competitorAgent) or
 * `/tendencias` (trendsAgent) where the entire page is plan-locked.
 */

import Link from 'next/link';
import { useAppStore } from '@/store/useAppStore';
import { PLAN_LIMITS, PLAN_META } from '@/types';
import type { SubscriptionPlan } from '@/types';
import { minimumPlanFor, upgradeLabel } from '@/lib/plan-features';

type FeatureKey = 'autoPublish' | 'competitorAgent' | 'trendsAgent' | 'autoComments' | 'videos';

export function PlanGate({
  feature,
  title,
  description,
  children,
}: {
  feature:     FeatureKey;
  title:       string;
  description: string;
  children:    React.ReactNode;
}) {
  const brand        = useAppStore((s) => s.brand);
  const brandLoading = useAppStore((s) => s.brandLoading);

  if (brandLoading) {
    return (
      <div className="page-content" style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <span className="loading-spinner" />
      </div>
    );
  }

  const plan: SubscriptionPlan = brand?.plan ?? 'starter';
  const allowed = feature === 'videos'
    ? PLAN_LIMITS[plan].videosPerWeek > 0
    : PLAN_LIMITS[plan][feature];

  if (allowed) return <>{children}</>;

  const minPlan = minimumPlanFor(feature);

  return (
    <div className="page-content" style={{ maxWidth: 640, padding: '80px 20px' }}>
      <div style={{ border: '1px solid #e5e7eb', background: '#ffffff', padding: '48px 40px', textAlign: 'center' }}>
        <div style={{ fontSize: 44, marginBottom: 16 }}>🔒</div>
        <h1 style={{
          fontFamily: "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif",
          fontWeight: 900,
          fontSize: 'clamp(1.8rem, 4vw, 2.4rem)',
          textTransform: 'uppercase',
          letterSpacing: '0.01em',
          color: '#111827',
          marginBottom: 12,
        }}>
          {title}
        </h1>
        <p style={{
          fontFamily: "var(--font-barlow), 'Barlow', sans-serif",
          fontSize: 15,
          color: '#6b7280',
          lineHeight: 1.6,
          marginBottom: 24,
        }}>
          {description}
        </p>
        <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', marginBottom: 28, display: 'inline-block' }}>
          <p style={{
            fontFamily: "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif",
            fontSize: 12,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: '#0F766E',
          }}>
            {upgradeLabel(minPlan)}
            {minPlan && ` · desde ${PLAN_META[minPlan].price}€/mes`}
          </p>
        </div>
        <div>
          <Link
            href="/settings/plan"
            style={{
              display: 'inline-block',
              padding: '14px 32px',
              background: '#111827',
              color: '#ffffff',
              fontFamily: "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif",
              fontSize: 13,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              textDecoration: 'none',
            }}
          >
            Ver planes disponibles →
          </Link>
        </div>
        <p style={{
          fontFamily: "var(--font-barlow), 'Barlow', sans-serif",
          fontSize: 12,
          color: '#9ca3af',
          marginTop: 16,
        }}>
          Plan actual: {PLAN_META[plan].label}
        </p>
      </div>
    </div>
  );
}
