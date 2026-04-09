'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LandingNav } from '@/components/layout/LandingNav';
import { SiteFooter } from '@/components/layout/SiteFooter';

// ─── Types ────────────────────────────────────────────────────────────────────

type BillingCycle = 'monthly' | 'annual';

interface Plan {
  name: string;
  monthlyPrice: number;
  desc: string;
  features: string[];
  featured: boolean;
  badge?: string;
}

interface ComparisonRow {
  feature: string;
  starter: string;
  pro: string;
  total: string;
  agencia: string;
}

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

// ─── Data ────────────────────────────────────────────────────────────────────

const PLANS: Plan[] = [
  {
    name: 'Starter',
    monthlyPrice: 29,
    desc: 'Para empezar con presencia constante en redes',
    featured: false,
    features: [
      '1 cuenta (Instagram o Facebook)',
      '2 posts de foto por semana',
      'Sin posts de vídeo',
      'Carruseles hasta 3 fotos',
      'Edición gestionada por nuestro equipo (base)',
      'Publicación manual (sin automatización)',
    ],
  },
  {
    name: 'Pro',
    monthlyPrice: 69,
    desc: 'Para crecer con foto, vídeo y automatización',
    featured: true,
    badge: '⚡ Más popular',
    features: [
      'Instagram + Facebook conectados',
      '3 posts de foto + 2 de vídeo por semana',
      'Carruseles hasta 8 fotos',
      'Edición gestionada por nuestro equipo (prioritaria)',
      'Solicitudes con IA incluidas',
      'Publicación automática programada',
      'Analytics avanzado',
      'Brand Kit completo',
    ],
  },
  {
    name: 'Total',
    monthlyPrice: 129,
    desc: 'Para escalar volumen con soporte y operación avanzada',
    featured: false,
    badge: '🚀 Completo',
    features: [
      'Instagram + Facebook conectados',
      '7 posts de foto + 7 de vídeo por semana',
      'Carruseles hasta 20 fotos',
      'Edición gestionada por nuestro equipo (prioritaria)',
      'Solicitudes con IA incluidas',
      'Publicación automática programada',
      'Analytics avanzado',
      'Brand Kit completo',
      'Soporte prioritario 24 h',
    ],
  },
  {
    name: 'Agencia',
    monthlyPrice: 199,
    desc: 'Para agencias y gestión de múltiples marcas',
    featured: false,
    features: [
      'Volumen de foto y vídeo a medida por marca',
      'Carruseles hasta 20 fotos',
      'Hasta 20 plataformas conectadas',
      'Panel de gestión unificado',
      'Edición gestionada por nuestro equipo (por marca)',
      'Solicitudes con IA incluidas',
      'Gestión multicliente',
      'Soporte prioritario 24 h',
    ],
  },
];

const COMPARISON_ROWS: ComparisonRow[] = [
  { feature: 'Posts de foto por semana', starter: '2', pro: '3', total: '7', agencia: 'A medida × marca' },
  { feature: 'Posts de vídeo por semana', starter: '—', pro: '2', total: '7', agencia: 'A medida × marca' },
  { feature: 'Fotos por carrusel', starter: '3', pro: '8', total: '20', agencia: '20' },
  { feature: 'Plataformas',            starter: '1',    pro: '2 (IG + FB)', total: '2 (IG + FB)',   agencia: 'Hasta 20' },
  { feature: 'Publicación automática', starter: '—',    pro: '✓',           total: '✓',             agencia: '✓' },
  { feature: 'Edición gestionada por nuestro equipo', starter: 'Sí (base)', pro: 'Sí (prioritaria)', total: 'Sí (prioritaria)', agencia: 'Sí (por marca)' },
  { feature: 'Solicitudes con IA (a demanda)', starter: '—', pro: 'Incluida', total: 'Incluida', agencia: 'Incluida' },
  { feature: 'Analytics avanzado',     starter: '—',    pro: '✓',           total: '✓',             agencia: '✓' },
  { feature: 'Brand Kit',              starter: '—',    pro: '✓',           total: '✓',             agencia: '✓' },
  { feature: 'Gestión multicliente',   starter: '—',    pro: '—',           total: '—',             agencia: '✓' },
  { feature: 'Soporte',                starter: 'Email', pro: 'Prioritario', total: 'Prioritario 24 h',  agencia: 'Prioritario 24 h' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function annualPrice(monthly: number): number {
  return Math.round(monthly * 0.8);
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

  const currentMonthlyMins = postsPerWeek * 4 * minsPerPost;
  const currentMonthlyHours = currentMonthlyMins / 60;
  const withNeuroPostHours = currentMonthlyHours * 0.1;
  const savedHours = currentMonthlyHours - withNeuroPostHours;
  const savedDays = savedHours / 8;

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
              max={7}
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
              <span>7 veces</span>
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
                ¿Cuántos minutos tardas por publicación?
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
              min={10}
              max={120}
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
              <span>10 min</span>
              <span>2 horas</span>
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PlanRecommender({ billing }: { billing: BillingCycle }) {
  const [photosPerWeek, setPhotosPerWeek] = useState(8);
  const [videosPerWeek, setVideosPerWeek] = useState(2);
  const [engagementGoal, setEngagementGoal] = useState(6);
  const [multiCompany, setMultiCompany] = useState(false);
  const [companiesCount, setCompaniesCount] = useState(2);

  const planRules = {
    starter: { photos: 2, videos: 0 },
    pro: { photos: 3, videos: 2 },
    total: { photos: 7, videos: 7 },
  } as const;

  let recommended: Plan = PLANS[0];
  if (multiCompany) {
    recommended = PLANS[3];
  } else if (photosPerWeek <= planRules.starter.photos && videosPerWeek <= planRules.starter.videos) {
    recommended = PLANS[0];
  } else if (photosPerWeek <= planRules.pro.photos && videosPerWeek <= planRules.pro.videos) {
    recommended = PLANS[1];
  } else if (photosPerWeek <= planRules.total.photos && videosPerWeek <= planRules.total.videos) {
    recommended = PLANS[2];
  } else {
    recommended = PLANS[3];
  }

  const workloadScore = photosPerWeek + videosPerWeek;
  const ambitionScore = workloadScore + engagementGoal;

  const price = billing === 'annual' ? annualPrice(recommended.monthlyPrice) : recommended.monthlyPrice;
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

            <div style={{ marginTop: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <label style={{ fontFamily: f, fontSize: '0.9rem', fontWeight: 700, color: 'var(--ink)' }}>
                  ¿Gestionas más de una empresa?
                </label>
                <button
                  type="button"
                  onClick={() => setMultiCompany((v) => !v)}
                  style={{
                    border: '1px solid var(--border)',
                    background: multiCompany ? 'var(--orange)' : '#ffffff',
                    color: multiCompany ? '#ffffff' : 'var(--muted)',
                    fontFamily: f,
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '6px 10px',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  {multiCompany ? 'Sí' : 'No'}
                </button>
              </div>

              {multiCompany && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <label style={{ fontFamily: f, fontSize: '0.86rem', fontWeight: 600, color: 'var(--muted)' }}>
                      Número de empresas
                    </label>
                    <span style={{ fontFamily: fc, fontSize: '1.1rem', fontWeight: 900, color: 'var(--orange)' }}>{companiesCount}</span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={10}
                    step={1}
                    value={companiesCount}
                    onChange={(e) => setCompaniesCount(Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--orange)', cursor: 'pointer' }}
                  />
                </>
              )}
            </div>
          </div>

          <aside style={{ background: '#111111', color: '#ffffff', padding: 22, border: '1px solid #111111' }}>
            <p style={{ fontFamily: f, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', marginBottom: 6 }}>
              Plan recomendado
            </p>
            <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 34, textTransform: 'uppercase', lineHeight: 0.95, marginBottom: 8 }}>
              {recommended.name}
            </p>
            <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 32, lineHeight: 1, marginBottom: 8 }}>
              <span style={{ fontSize: 16, verticalAlign: 'top' }}>€</span>{price}
              <span style={{ fontFamily: f, fontSize: 12, fontWeight: 500, color: '#9ca3af' }}>/mes</span>
            </p>
            {billing === 'annual' && (
              <p style={{ fontFamily: f, fontSize: 12, fontWeight: 700, color: '#34d399', marginBottom: 12 }}>
                Ahorras €{savings}/año
              </p>
            )}

            <p style={{ fontFamily: f, color: '#d1d5db', fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
              {recommended.desc}
            </p>

            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8, marginBottom: 16 }}>
              <li style={{ fontFamily: f, fontSize: 12, color: '#d1d5db' }}>✔ Carga estimada: {photosPerWeek + videosPerWeek} piezas/semana</li>
              <li style={{ fontFamily: f, fontSize: 12, color: '#d1d5db' }}>✔ Intensidad de crecimiento: {engagementGoal}/10</li>
              <li style={{ fontFamily: f, fontSize: 12, color: '#d1d5db' }}>✔ Score total: {Math.round(ambitionScore)}</li>
              {multiCompany && <li style={{ fontFamily: f, fontSize: 12, color: '#d1d5db' }}>✔ Empresas: {companiesCount}</li>}
            </ul>

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
    return isAnnual ? annualPrice(plan.monthlyPrice) : plan.monthlyPrice;
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
          <p
            style={{
              color: 'var(--muted)',
              fontSize: '1.05rem',
              lineHeight: 1.7,
              maxWidth: '480px',
              margin: '0 auto 40px',
            }}
          >
            14 días gratis en todos los planes. Sin tarjeta de crédito. Sin permanencia.
          </p>

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
                      −20%
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div style={{ overflowX: 'auto', overflowY: 'visible', paddingTop: 10, paddingBottom: 4 }}>
            <div className="pricing-grid" style={{ minWidth: 1040, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, alignItems: 'stretch' }}>
              {PLANS.map((plan) => {
                const price = displayPrice(plan);
                const savings = annualSavings(plan.monthlyPrice);

                return (
                  <div key={plan.name} className={`plan${plan.featured ? ' featured' : ''}`}>
                    {plan.badge && <div className="plan-badge">{plan.badge}</div>}
                    <div className="plan-name">{plan.name}</div>
                    <div className="plan-price">
                      <sup>€</sup>
                      {price}
                      <span>/mes</span>
                    </div>

                    {/* Annual savings badge */}
                    {isAnnual && (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: plan.featured ? 'rgba(255,92,26,0.2)' : 'var(--orange-light)',
                          color: plan.featured ? '#ffb899' : 'var(--orange)',
                          fontFamily: f,
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          padding: '4px 12px',
                          borderRadius: '0',
                          marginBottom: '8px',
                        }}
                      >
                        Ahorras €{savings}/año
                      </div>
                    )}

                    <div className="plan-desc">{plan.desc}</div>
                    <ul className="plan-features">
                      {plan.features.map((f) => (
                        <li key={f}>{f}</li>
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
            🔒 Pago seguro con Stripe · Cancela en cualquier momento · Sin permanencia
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
                maxWidth: '820px',
                margin: '0 auto',
                borderCollapse: 'collapse',
                fontFamily: f,
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      padding: '16px 20px',
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
                  {(['Starter', 'Pro', 'Total', 'Agencia'] as const).map((col) => (
                    <th
                      key={col}
                      style={{
                        padding: '16px 20px',
                        textAlign: 'center',
                        fontSize: '0.88rem',
                        fontWeight: 800,
                        color: col === 'Pro' ? 'var(--orange)' : 'var(--ink)',
                        borderBottom: '2px solid var(--border)',
                        background: col === 'Pro' ? 'rgba(255,92,26,0.04)' : 'transparent',
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
                        padding: '14px 20px',
                        fontSize: '0.9rem',
                        color: 'var(--ink)',
                        fontWeight: 600,
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      {row.feature}
                    </td>
                    {([row.starter, row.pro, row.total, row.agencia] as const).map((val, j) => (
                      <td
                        key={j}
                        style={{
                          padding: '14px 20px',
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
                          fontSize: val === '✓' || val === '—' ? '1rem' : '0.88rem',
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
          <p className="cta-sub">14 días gratis. Sin tarjeta de crédito. Sin permanencia.</p>
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
            ✓ Cancela cuando quieras &nbsp;·&nbsp; ✓ Sin permanencia &nbsp;·&nbsp; ✓ GDPR compliant
          </p>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <FooterSection />
    </>
  );
}
