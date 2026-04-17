'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LandingNav } from '@/components/layout/LandingNav';
import { SiteFooter } from '@/components/layout/SiteFooter';

// ─── Types ────────────────────────────────────────────────────────────────────

type BillingCycle = 'monthly' | 'annual';

interface Plan {
  name:          string;
  monthlyPrice:  number;
  annualPrice:   number;
  annualSavings: number;
  desc:          string;
  content:       string[];
  highlight:     string;
  features:      string[];
  featured:      boolean;
  badge?:        string;
}

interface ComparisonRow {
  feature: string;
  starter: string;
  pro: string;
  total: string;
}

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

// ─── Data ────────────────────────────────────────────────────────────────────

const PLANS: Plan[] = [
  {
    name:          'Esencial',
    monthlyPrice:   25,
    annualPrice:    21,
    annualSavings:  48,
    desc:          'Para presencia activa',
    content:       ['✔ 2 fotos/semana', '✔ Carruseles hasta 3', '✔ Sin vídeo/reel', '✔ Instagram + Facebook'],
    highlight:     'Ideal para empezar con redes. Precio por 1 red social.',
    featured: false,
    features: [
      '1 red social incluida',
      '+15 EUR/mes por red adicional',
      'Publicación programada',
      'Calendario avanzado',
      'Edición de contenido',
      'Solicitudes personalizadas',
      'Análisis de rendimiento',
      'IA integrada',
      'Soporte por email',
    ],
  },
  {
    name:          'Crecimiento',
    monthlyPrice:   76,
    annualPrice:    63,
    annualSavings:  158,
    desc:          'Máximo alcance',
    content:       ['✔ 4 fotos/semana', '✔ 2 vídeos/reels/sem', '✔ Carruseles hasta 8', '✔ Instagram + Facebook + TikTok'],
    highlight:     'Vídeo/reel + TikTok para máximo alcance. Precio por 1 red social.',
    featured: true,
    badge: 'Más popular',
    features: [
      '1 red social incluida',
      '+15 EUR/mes por red adicional',
      'TikTok disponible',
      'Publicación programada',
      'Ideas basadas en tendencias y tu contenido',
      'Mejores horas para publicar',
      'Solicitudes personalizadas',
      'Análisis de rendimiento',
      'IA integrada',
      'Soporte prioritario',
    ],
  },
  {
    name:          'Profesional',
    monthlyPrice:   161,
    annualPrice:    133,
    annualSavings:  336,
    desc:          'Control completo',
    content:       ['✔ Hasta 20 fotos/semana', '✔ 10 vídeos/reels/sem', '✔ Carruseles hasta 20', '✔ Instagram + Facebook + TikTok'],
    highlight:     'Conversión máxima. Precio por 1 red social.',
    featured: false,
    badge: 'Completo',
    features: [
      '1 red social incluida',
      '+15 EUR/mes por red adicional',
      'TikTok disponible',
      'Publicación programada',
      'Ideas basadas en tendencias y tu contenido',
      'Mejores horas para publicar',
      'Solicitudes personalizadas',
      'Análisis de rendimiento',
      'IA integrada',
      'Soporte 24h',
    ],
  },
];

const COMPARISON_ROWS: ComparisonRow[] = [
  { feature: 'Precio base (1 red)',           starter: '21 EUR/mes', pro: '63 EUR/mes',       total: '133 EUR/mes' },
  { feature: 'Red social extra',              starter: '+15 EUR/mes', pro: '+15 EUR/mes',      total: '+15 EUR/mes' },
  { feature: 'Redes disponibles',             starter: 'IG, FB',     pro: 'IG, FB, TikTok',   total: 'IG, FB, TikTok' },
  { feature: 'Fotos por semana',              starter: '2',          pro: '4',                total: 'Hasta 20' },
  { feature: 'Vídeo/reel por semana',         starter: '—',          pro: '2',                total: '10' },
  { feature: 'Carruseles (máx. fotos)',        starter: 'Hasta 3',   pro: 'Hasta 8',          total: 'Hasta 20' },
  { feature: 'Publicación programada',         starter: '✓',         pro: '✓',               total: '✓' },
  { feature: 'Calendario avanzado',            starter: '✓',         pro: '✓',               total: '✓' },
  { feature: 'Edición de contenido',           starter: '✓',         pro: '✓',               total: '✓' },
  { feature: 'Solicitudes personalizadas',     starter: '✓',         pro: '✓',               total: '✓' },
  { feature: 'IA integrada',                  starter: '✓',         pro: '✓',               total: '✓' },
  { feature: 'Ideas basadas en tendencias',    starter: '—',         pro: '✓',               total: '✓' },
  { feature: 'Mejores horas para publicar',    starter: '—',         pro: '✓',               total: '✓' },
  { feature: 'Análisis de rendimiento',        starter: '✓',         pro: '✓',               total: '✓' },
  { feature: 'Soporte',                        starter: 'Email',     pro: 'Prioritario',     total: '24h' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function annualPrice(monthly: number): number {
  return Math.round(monthly * 0.85);
}

function annualSavings(monthly: number): number {
  return Math.round((monthly - annualPrice(monthly)) * 12);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function NavBar() {
  return <LandingNav />;
}

function FooterSection() {
  return <SiteFooter />;
}

// ─── ROI Calculator ───────────────────────────────────────────────────────────

function RoiCalculator() {
  const [postsPerWeek, setPostsPerWeek] = useState(3);
  const [minsPerPost, setMinsPerPost] = useState(45);
  const [hourlyRate, setHourlyRate] = useState(14);

  const currentMonthlyMins = postsPerWeek * 4 * minsPerPost;
  const currentMonthlyHours = currentMonthlyMins / 60;
  const withNeuroPostHours = currentMonthlyHours * 0.1;
  const savedHours = currentMonthlyHours - withNeuroPostHours;
  const savedDays = savedHours / 8;
  const monthlySavingsEur = savedHours * hourlyRate;
  const yearlySavingsEur = monthlySavingsEur * 12;

  return (
    <section
      style={{
        padding: '100px 0',
        background: 'var(--warm)',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div className="container">
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <div className="section-eyebrow">ROI real</div>
          <h2>Calcula tu ahorro</h2>
          <p className="section-sub" style={{ margin: '12px auto 0', textAlign: 'center' }}>
            Descubre cuánto tiempo (y dinero) recuperas cada mes.
          </p>
        </div>

        <div
          style={{
            maxWidth: '760px',
            margin: '0 auto',
            background: 'white',
            border: '1.5px solid var(--border)',
            borderRadius: '0',
            padding: '48px',
          }}
        >
          {/* Slider 1 */}
          <div style={{ marginBottom: '36px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
              }}
            >
              <label
                style={{
                  fontFamily: f,
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  color: 'var(--ink)',
                }}
              >
                ¿Cuántas veces publicas por semana?
              </label>
              <span
                style={{
                  fontFamily: fc,
                  fontWeight: 900,
                  fontSize: '1.4rem',
                  color: 'var(--orange)',
                }}
              >
                {postsPerWeek}×
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={20}
              value={postsPerWeek}
              onChange={(e) => setPostsPerWeek(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--orange)', cursor: 'pointer', height: '6px' }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontFamily: f,
                fontSize: '0.78rem',
                color: 'var(--muted)',
                marginTop: '6px',
              }}
            >
              <span>1 vez</span>
              <span>20 veces</span>
            </div>
          </div>

          {/* Slider 2 */}
          <div style={{ marginBottom: '40px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
              }}
            >
              <label
                style={{
                  fontFamily: f,
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  color: 'var(--ink)',
                }}
              >
                ¿Cuántos minutos tardas entre hacer un buen plano, editar y publicar?
              </label>
              <span
                style={{
                  fontFamily: fc,
                  fontWeight: 900,
                  fontSize: '1.4rem',
                  color: 'var(--orange)',
                }}
              >
                {minsPerPost} min
              </span>
            </div>
            <input
              type="range"
              min={5}
              max={240}
              step={5}
              value={minsPerPost}
              onChange={(e) => setMinsPerPost(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--orange)', cursor: 'pointer', height: '6px' }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontFamily: f,
                fontSize: '0.78rem',
                color: 'var(--muted)',
                marginTop: '6px',
              }}
            >
              <span>5 min</span>
              <span>4 horas</span>
            </div>
          </div>

          {/* Slider 3 */}
          <div style={{ marginBottom: '40px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
              }}
            >
              <label
                style={{
                  fontFamily: f,
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  color: 'var(--ink)',
                }}
              >
                Coste por hora de una persona (€)
              </label>
              <span
                style={{
                  fontFamily: fc,
                  fontWeight: 900,
                  fontSize: '1.4rem',
                  color: 'var(--orange)',
                }}
              >
                {hourlyRate} €/h
              </span>
            </div>
            <input
              type="range"
              min={8}
              max={40}
              step={1}
              value={hourlyRate}
              onChange={(e) => setHourlyRate(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--orange)', cursor: 'pointer', height: '6px' }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontFamily: f,
                fontSize: '0.78rem',
                color: 'var(--muted)',
                marginTop: '6px',
              }}
            >
              <span>8 €/h</span>
              <span>40 €/h</span>
            </div>
          </div>

          {/* Results */}
          <div
            style={{
              background: 'var(--warm)',
              border: '1px solid var(--border)',
              borderRadius: '14px',
              padding: '28px 32px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '20px',
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: f,
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--muted)',
                  marginBottom: '6px',
                }}
              >
                Tiempo actual al mes
              </div>
              <div
                style={{
                  fontFamily: fc,
                  fontSize: '1.8rem',
                  fontWeight: 900,
                  color: 'var(--ink)',
                  letterSpacing: '-0.03em',
                }}
              >
                {currentMonthlyHours.toFixed(1)} h
              </div>
              <div
                style={{
                  fontFamily: f,
                  fontSize: '0.8rem',
                  color: 'var(--muted)',
                  marginTop: '4px',
                }}
              >
                {postsPerWeek} posts/sem × 4 semanas × {minsPerPost} min
              </div>
            </div>

            <div>
              <div
                style={{
                  fontFamily: f,
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--muted)',
                  marginBottom: '6px',
                }}
              >
                Con NeuroPost (90% menos)
              </div>
              <div
                style={{
                  fontFamily: fc,
                  fontSize: '1.8rem',
                  fontWeight: 900,
                  color: 'var(--ink)',
                  letterSpacing: '-0.03em',
                }}
              >
                {withNeuroPostHours.toFixed(1)} h
              </div>
              <div
                style={{
                  fontFamily: f,
                  fontSize: '0.8rem',
                  color: 'var(--muted)',
                  marginTop: '4px',
                }}
              >
                Solo revisar y aprobar
              </div>
            </div>

            {/* Savings highlight — full width */}
            <div
              style={{
                gridColumn: 'span 2',
                background: 'var(--ink)',
                borderRadius: '0',
                padding: '20px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: f,
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'rgba(250,248,243,0.5)',
                    marginBottom: '4px',
                  }}
                >
                  Ahorro mensual
                </div>
                <div
                  style={{
                    fontFamily: fc,
                    fontSize: '2.2rem',
                    fontWeight: 900,
                    color: 'var(--accent-glow)',
                    letterSpacing: '-0.04em',
                    lineHeight: 1,
                  }}
                >
                  {savedHours.toFixed(1)} horas
                </div>
              </div>
              <div
                style={{
                  textAlign: 'right',
                  fontFamily: f,
                  fontSize: '0.9rem',
                  color: 'rgba(250,248,243,0.6)',
                }}
              >
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--accent-glow)', letterSpacing: '-0.02em' }}>
                  {savedDays.toFixed(1)} días
                </div>
                <div>de trabajo al mes</div>
                <div style={{ fontSize: '0.78rem', marginTop: '4px', color: 'rgba(250,248,243,0.4)' }}>
                  calculado a 8 h/día
                </div>
                <div style={{ marginTop: '10px', fontSize: '0.85rem', color: 'rgba(250,248,243,0.92)', fontWeight: 700 }}>
                  ≈ €{Math.round(monthlySavingsEur).toLocaleString('es-ES')}/mes
                </div>
                <div style={{ fontSize: '0.78rem', color: 'rgba(250,248,243,0.7)' }}>
                  (€{hourlyRate}/h · ahorro anual ≈ €{Math.round(yearlySavingsEur).toLocaleString('es-ES')})
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PlanRecommender({ billing }: { billing: BillingCycle }) {
  const [photosPerWeek, setPhotosPerWeek] = useState(3);
  const [videosPerWeek, setVideosPerWeek] = useState(1);
  const [engagementGoal, setEngagementGoal] = useState(5);

  // Limits that each plan actually includes (must match PLANS data above)
  const planLimits = [
    { plan: PLANS[0], photos: 2,  videos: 0  },   // Starter
    { plan: PLANS[1], photos: 4,  videos: 2  },   // Pro
    { plan: PLANS[2], photos: 20, videos: 10 },   // Total
  ] as const;

  // High engagement (≥8/10) nudges toward at least Pro
  const minTierByEngagement = engagementGoal >= 8 ? 1 : 0;

  let recommendedIdx = planLimits.length - 1; // default to Total
  for (let i = 0; i < planLimits.length; i++) {
    if (photosPerWeek <= planLimits[i].photos && videosPerWeek <= planLimits[i].videos && i >= minTierByEngagement) {
      recommendedIdx = i;
      break;
    }
  }
  const recommended = planLimits[recommendedIdx].plan;
  const includedPhotos = planLimits[recommendedIdx].photos;
  const includedVideos = planLimits[recommendedIdx].videos;

  // Extras only exist if user requests more than any plan covers (beyond Total)
  const extraPhotos = Math.max(0, photosPerWeek - includedPhotos);
  const extraVideos = Math.max(0, videosPerWeek - includedVideos);

  const basePrice = billing === 'annual' ? annualPrice(recommended.monthlyPrice) : recommended.monthlyPrice;
  const savings = annualSavings(recommended.monthlyPrice);

  return (
    <section
      style={{
        padding: '70px 0 48px',
        background: '#ffffff',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div className="container" style={{ maxWidth: 980 }}>
        <div style={{ textAlign: 'center', marginBottom: 34 }}>
          <div className="section-eyebrow">Recomendador inteligente</div>
          <h2 style={{ marginBottom: 10 }}>¿Qué plan te encaja mejor?</h2>
          <p className="section-sub" style={{ margin: '0 auto', maxWidth: 620, textAlign: 'center' }}>
            Mueve los controles según tu ritmo de contenido y objetivo de engagement. Te sugerimos un plan en tiempo real.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 320px',
            gap: 18,
            alignItems: 'start',
          }}
          className="pricing-recommender-grid"
        >
          <div style={{ background: '#f8fafc', border: '1px solid var(--border)', padding: 24 }}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ fontFamily: f, fontSize: '0.9rem', fontWeight: 700, color: 'var(--ink)' }}>
                  Fotos por semana
                </label>
                <span style={{ fontFamily: fc, fontSize: '1.2rem', fontWeight: 900, color: 'var(--orange)' }}>{photosPerWeek}</span>
              </div>
              <input
                type="range"
                min={0}
                max={30}
                step={1}
                value={photosPerWeek}
                onChange={(e) => setPhotosPerWeek(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--orange)', cursor: 'pointer' }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ fontFamily: f, fontSize: '0.9rem', fontWeight: 700, color: 'var(--ink)' }}>
                  Vídeos por semana
                </label>
                <span style={{ fontFamily: fc, fontSize: '1.2rem', fontWeight: 900, color: 'var(--orange)' }}>{videosPerWeek}</span>
              </div>
              <input
                type="range"
                min={0}
                max={14}
                step={1}
                value={videosPerWeek}
                onChange={(e) => setVideosPerWeek(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--orange)', cursor: 'pointer' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ fontFamily: f, fontSize: '0.9rem', fontWeight: 700, color: 'var(--ink)' }}>
                  Objetivo de engagement
                </label>
                <span style={{ fontFamily: fc, fontSize: '1.2rem', fontWeight: 900, color: 'var(--orange)' }}>{engagementGoal}/10</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={engagementGoal}
                onChange={(e) => setEngagementGoal(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--orange)', cursor: 'pointer' }}
              />
            </div>

          </div>

          <aside style={{ background: '#111111', color: '#ffffff', padding: 22, border: '1px solid #111111' }}>
            <p style={{ fontFamily: f, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', marginBottom: 6 }}>
              Plan recomendado
            </p>
            <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 34, textTransform: 'uppercase', lineHeight: 0.95, marginBottom: 8 }}>
              {recommended.name}
            </p>
            <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 32, lineHeight: 1, marginBottom: 4 }}>
              <span style={{ fontSize: 16, verticalAlign: 'top' }}>€</span>{basePrice}
              <span style={{ fontFamily: f, fontSize: 12, fontWeight: 500, color: '#9ca3af' }}>/mes</span>
            </p>
            {billing === 'annual' && (
              <p style={{ fontFamily: f, fontSize: 12, fontWeight: 700, color: '#34d399', marginBottom: 12 }}>
                Ahorras €{savings}/año
              </p>
            )}

            <p style={{ fontFamily: f, color: '#d1d5db', fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
              {recommended.desc}
            </p>

            {/* What's included vs what you asked for */}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6, marginBottom: 14 }}>
              <li style={{ fontFamily: f, fontSize: 12, color: '#d1d5db' }}>
                📷 {photosPerWeek} foto{photosPerWeek !== 1 ? 's' : ''}/sem
                {extraPhotos > 0
                  ? <span style={{ color: '#fca5a5', marginLeft: 4 }}>({includedPhotos} incl. + {extraPhotos} extra)</span>
                  : <span style={{ color: '#6ee7b7', marginLeft: 4 }}>✓ incluido</span>}
              </li>
              <li style={{ fontFamily: f, fontSize: 12, color: '#d1d5db' }}>
                🎬 {videosPerWeek} vídeo{videosPerWeek !== 1 ? 's' : ''}/sem
                {extraVideos > 0
                  ? <span style={{ color: '#fca5a5', marginLeft: 4 }}>({includedVideos} incl. + {extraVideos} extra)</span>
                  : <span style={{ color: '#6ee7b7', marginLeft: 4 }}>✓ incluido</span>}
              </li>
              <li style={{ fontFamily: f, fontSize: 12, color: '#d1d5db' }}>
                📈 Engagement {engagementGoal}/10
                {engagementGoal >= 8
                  ? <span style={{ color: '#fde68a', marginLeft: 4 }}>(alta intensidad)</span>
                  : <span style={{ color: '#6ee7b7', marginLeft: 4 }}>✓ ok</span>}
              </li>
            </ul>

            {(extraPhotos > 0 || extraVideos > 0) && (
              <p style={{ fontFamily: f, fontSize: 11, color: '#fca5a5', marginBottom: 12, lineHeight: 1.5 }}>
                Superas los límites del plan Total. Escríbenos para un precio personalizado.
              </p>
            )}

            <a href="#pricing-plans" style={{ display: 'inline-block', width: '100%', textAlign: 'center', background: '#ffffff', color: '#111111', textDecoration: 'none', fontFamily: fc, fontWeight: 700, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '10px 14px' }}>
              Ver plan abajo
            </a>
          </aside>
        </div>
      </div>
    </section>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const [billing, setBilling] = useState<BillingCycle>('annual');

  const isAnnual = billing === 'annual';

  function displayPrice(plan: Plan): number {
    return isAnnual ? plan.annualPrice : plan.monthlyPrice;
  }

  return (
    <>
      {/* ─── NAV ─── */}
      <NavBar />

      {/* ─── HERO ─── */}
      <section
        id="pricing-top"
        style={{
          background: 'var(--cream)',
          color: 'var(--ink)',
          padding: '140px 0 80px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 50% 60% at 50% 100%, rgba(15,118,110,0.10) 0%, transparent 70%)',
          }}
        />
        <div className="container" style={{ position: 'relative' }}>
          <div className="section-eyebrow" style={{ color: 'var(--accent)', display: 'inline-block' }}>
            Sin sorpresas
          </div>
          <h2
            style={{
              color: 'var(--ink)',
              fontSize: 'clamp(2.2rem, 5vw, 3.6rem)',
              marginBottom: '16px',
              marginTop: '12px',
            }}
          >
            Precios claros.<br />Cancela cuando quieras.
          </h2>

        </div>
      </section>

      <PlanRecommender billing={billing} />

      {/* ─── PRICING GRID ─── */}
      <section
        id="pricing-plans"
        style={{
          background: '#ffffff',
          padding: '80px 0 100px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 52 }}>
            <div
              style={{
                display: 'inline-flex',
                background: '#ffffff',
                border: '1px solid var(--border)',
                borderRadius: '0',
                padding: '4px',
                gap: '4px',
              }}
            >
              {(['monthly', 'annual'] as const).map((cycle) => (
                <button
                  key={cycle}
                  onClick={() => setBilling(cycle)}
                  style={{
                    padding: '9px 22px',
                    borderRadius: '0',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: f,
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    transition: 'all 0.2s',
                    background: billing === cycle ? 'var(--orange)' : 'transparent',
                    color: billing === cycle ? '#ffffff' : 'var(--muted)',
                  }}
                >
                  {cycle === 'monthly' ? 'Mensual' : 'Anual'}
                  {cycle === 'annual' && (
                    <span
                      style={{
                        marginLeft: '6px',
                        background: billing === 'annual' ? 'rgba(255,255,255,0.2)' : 'var(--orange-light)',
                        color: billing === 'annual' ? 'white' : 'var(--orange)',
                        borderRadius: '0',
                        padding: '2px 8px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                      }}
                    >
                      −15%
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div style={{ overflowX: 'auto', overflowY: 'visible', paddingTop: 10, paddingBottom: 4 }}>
            <div className="pricing-grid" style={{ minWidth: 780, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, alignItems: 'stretch' }}>
              {PLANS.map((plan) => {
                const price = displayPrice(plan);

                return (
                  <div key={plan.name} className={`plan${plan.featured ? ' featured' : ''}`}>
                    {plan.badge && <div className="plan-badge">{plan.badge}</div>}
                    <div className="plan-name">{plan.name}</div>
                    <div className="plan-price">
                      <sup>€</sup>
                      {price}
                      <span>/mes</span>
                    </div>

                    {isAnnual && (
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        background: plan.featured ? 'rgba(15,118,110,0.22)' : 'var(--accent-light)',
                        color: plan.featured ? '#7cf5ea' : 'var(--accent)',
                        fontFamily: f, fontSize: '0.78rem', fontWeight: 800,
                        padding: '4px 12px', borderRadius: '0', marginBottom: '8px',
                      }}>
                        Ahorras €{plan.annualSavings}/año
                      </div>
                    )}

                    <div className="plan-desc">{plan.desc}</div>

                    {/* Content block */}
                    <div style={{
                      border: `1px solid ${plan.featured ? 'rgba(255,255,255,0.2)' : 'var(--border)'}`,
                      padding: '10px 12px', marginBottom: 12,
                    }}>
                      <div style={{
                        fontSize: 10, fontWeight: 800, textTransform: 'uppercase' as const,
                        letterSpacing: '0.08em', marginBottom: 8, fontFamily: fc,
                        color: plan.featured ? 'rgba(255,255,255,0.6)' : 'var(--muted)',
                      }}>
                        Contenido incluido
                      </div>
                      {plan.content.map((item) => (
                        <div key={item} style={{
                          fontSize: 13, fontWeight: 600, marginBottom: 4, fontFamily: f,
                          color: plan.featured ? '#ffffff' : 'var(--ink)',
                        }}>
                          {item}
                        </div>
                      ))}
                      <div style={{
                        fontSize: 11, marginTop: 8, fontStyle: 'italic', fontFamily: f,
                        color: plan.featured ? 'rgba(255,255,255,0.6)' : 'var(--muted)',
                      }}>
                        {plan.highlight}
                      </div>
                    </div>

                    <ul className="plan-features">
                      {plan.features.map((feat) => (
                        <li key={feat}>{feat}</li>
                      ))}
                    </ul>
                    <Link href="/register" className="plan-btn" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
                      Empezar gratis →
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pricing-note">
            🔒 Pago seguro con Stripe · Cancela en cualquier momento
          </div>
        </div>
      </section>

      {/* ─── COMPARISON TABLE ─── */}
      <section style={{ padding: '100px 0', background: '#ffffff' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <div className="section-eyebrow">Comparativa</div>
            <h2>¿Qué incluye cada plan?</h2>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                maxWidth: '860px',
                margin: '0 auto',
                borderCollapse: 'collapse',
                fontFamily: f,
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      padding: '16px 22px',
                      textAlign: 'left',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: 'var(--muted)',
                      borderBottom: '2px solid var(--border)',
                    }}
                  >
                    Función
                  </th>
                  {(['STARTER', 'PRO', 'TOTAL'] as const).map((col) => (
                    <th
                      key={col}
                      style={{
                        padding: '16px 22px',
                        textAlign: 'center',
                        fontSize: '0.88rem',
                        fontWeight: 800,
                        color: col === 'PRO' ? 'var(--orange)' : 'var(--ink)',
                        borderBottom: '2px solid var(--border)',
                        background: col === 'PRO' ? 'rgba(255,92,26,0.04)' : 'transparent',
                        borderRadius: undefined,
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, i) => (
                  <tr
                    key={row.feature}
                    style={{ background: i % 2 === 0 ? 'white' : 'var(--warm)' }}
                  >
                    <td
                      style={{
                        padding: '14px 22px',
                        fontSize: '0.84rem',
                        color: 'var(--ink)',
                        fontWeight: 600,
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      {row.feature}
                    </td>
                    {([row.starter, row.pro, row.total] as const).map((val, j) => (
                      <td
                        key={j}
                        style={{
                          padding: '14px 22px',
                          textAlign: 'center',
                          borderBottom: '1px solid var(--border)',
                          background: j === 1 ? 'rgba(255,92,26,0.04)' : undefined,
                          color:
                            val === '✓'
                              ? 'var(--green)'
                              : val === '—'
                                ? 'var(--border)'
                                : 'var(--ink)',
                          fontWeight: val === '✓' || val === '—' ? 900 : 500,
                          fontSize: val === '✓' || val === '—' ? '0.94rem' : '0.82rem',
                        }}
                      >
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p style={{ maxWidth: '820px', margin: '14px auto 0', fontFamily: f, fontSize: '0.8rem', color: 'var(--muted)' }}>
            * Adapta el contenido a tus objetivos: más fotos o más vídeos.
          </p>
        </div>
      </section>

      {/* ─── ROI CALCULATOR ─── */}
      <RoiCalculator />

      {/* ─── TRUST SECTION ─── */}
      <section
        style={{
          padding: '60px 0',
          background: '#ffffff',
          borderTop: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="container">
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '28px',
              textAlign: 'center',
            }}
          >
            {/* Payment logos row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '32px',
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}
            >
              {['Visa', 'Mastercard', 'SEPA', 'Stripe'].map((brand) => (
                <div
                  key={brand}
                  style={{
                    fontFamily: f,
                    fontWeight: 800,
                    fontSize: '1rem',
                    color: 'var(--muted)',
                    letterSpacing: '-0.01em',
                    padding: '8px 20px',
                    border: '1.5px solid var(--border)',
                    borderRadius: '0',
                    background: 'white',
                  }}
                >
                  {brand}
                </div>
              ))}
            </div>

            {/* PCI badge */}
            <div
              style={{
                fontFamily: f,
                fontSize: '0.85rem',
                color: 'var(--muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span style={{ fontSize: '1rem' }}>🔒</span>
              Pago procesado por Stripe · Certificado PCI DSS
            </div>

          </div>
        </div>
      </section>

      {/* ─── CTA FINAL ─── */}
      <section className="cta-final">
        <div className="container">
          <h2>
            Empieza hoy y recupera<br /><em>horas de tu semana</em>
          </h2>
          <p className="cta-sub">Sin compromiso. Cancela cuando quieras.</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', position: 'relative' }}>
            <Link
              href="/register"
              style={{
                padding: '14px 32px',
                background: 'var(--orange)',
                color: 'white',
                borderRadius: '0',
                fontFamily: f,
                fontWeight: 800,
                fontSize: '1rem',
                textDecoration: 'none',
                transition: 'all 0.2s',
                display: 'inline-block',
              }}
            >
              Crear cuenta gratis →
            </Link>
            <Link
              href="/pricing#pricing-top"
              style={{
                padding: '14px 32px',
                background: 'transparent',
                color: 'rgba(250,248,243,0.6)',
                border: '1.5px solid rgba(250,248,243,0.15)',
                borderRadius: '0',
                fontFamily: f,
                fontWeight: 700,
                fontSize: '1rem',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Ver planes
            </Link>
          </div>
          <p className="cta-guarantee">
            ✓ Cancela cuando quieras &nbsp;·&nbsp; ✓ GDPR compliant
          </p>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <FooterSection />
    </>
  );
}
